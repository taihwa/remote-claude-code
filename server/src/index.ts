// ============================================================
// Server Entry Point - Hono app with WebSocket support
// ============================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (not cwd, which may be server/ in workspace mode)
config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolveAuthToken, authMiddleware, validateWsToken } from './auth.js';
import { SessionManager } from './session-manager.js';
import { ProjectManager } from './project-manager.js';
import { handleWsMessage } from './ws-handler.js';
import { permissionBridge } from './permission-bridge.js';
import { checkSavedPermission } from './settings-manager.js';
import type { WSContext } from 'hono/ws';

const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

// -------------------------------------------------------
// Initialize
// -------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3456', 10);
let authToken = resolveAuthToken();
const sessionManager = new SessionManager(PORT);
const projectManager = new ProjectManager();

// Track the active WebSocket client for permission relay
let activeWs: WSContext | null = null;

// -------------------------------------------------------
// Hono App
// -------------------------------------------------------

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Auth middleware on API routes only (static files are public, WS uses query param auth)
// Permission endpoint is exempted (localhost-only internal communication from MCP server)
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/permission') {
    return next();
  }
  return authMiddleware(authToken)(c, next);
});

// -------------------------------------------------------
// WebSocket endpoint
// -------------------------------------------------------

app.get(
  '/ws',
  upgradeWebSocket((c) => {
    // Validate token from query parameter for WebSocket connections
    const token = c.req.query('token');
    const isValid = validateWsToken(token, authToken);

    return {
      onOpen(evt, ws) {
        if (!isValid) {
          console.log('[WS] Connection rejected: invalid token');
          ws.close(4001, 'Unauthorized');
          return;
        }
        console.log('[WS] Client connected');
        activeWs = ws;
      },

      onMessage(evt, ws) {
        if (!isValid) return;
        // evt.data is string | Blob | ArrayBufferLike; in Node.js with ws it is string or Buffer
        let data: string;
        if (typeof evt.data === 'string') {
          data = evt.data;
        } else if (evt.data instanceof ArrayBuffer || ArrayBuffer.isView(evt.data)) {
          data = new TextDecoder().decode(evt.data as ArrayBuffer);
        } else {
          // Blob or other - convert via toString as fallback
          data = String(evt.data);
        }
        handleWsMessage(ws, data, sessionManager, projectManager, permissionBridge);
      },

      onClose(evt, ws) {
        console.log('[WS] Client disconnected');
        if (activeWs === ws) {
          activeWs = null;
        }
        // If the client disconnects, cancel any running process
        if (sessionManager.isActive()) {
          console.log('[WS] Cancelling active session due to disconnect');
          sessionManager.cancel();
        }
      },

      onError(evt, ws) {
        console.error('[WS] Error:', evt);
      },
    };
  }),
);

// -------------------------------------------------------
// REST API
// -------------------------------------------------------

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    version: '0.0.1',
    activeSession: sessionManager.isActive(),
    sessionId: sessionManager.getSessionId(),
  });
});

// -------------------------------------------------------
// Settings API
// -------------------------------------------------------

const ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

function updateEnvFile(key: string, value: string) {
  let content: string;
  try {
    content = readFileSync(ENV_PATH, 'utf-8');
  } catch {
    content = '';
  }
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  writeFileSync(ENV_PATH, content);
}

function readEnvFile(): Record<string, string> {
  try {
    const content = readFileSync(ENV_PATH, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) {
        result[match[1]] = match[2];
      }
    }
    return result;
  } catch {
    return {};
  }
}

app.get('/api/settings', (c) => {
  const env = readEnvFile();
  return c.json({
    authToken: env.AUTH_TOKEN || '',
    allowedProjects: env.ALLOWED_PROJECTS || '',
    port: PORT,
  });
});

app.post('/api/settings', async (c) => {
  const body = (await c.req.json()) as {
    authToken?: string;
    allowedProjects?: string;
  };

  let tokenChanged = false;

  if (body.authToken !== undefined && body.authToken.trim()) {
    const newToken = body.authToken.trim();
    updateEnvFile('AUTH_TOKEN', newToken);
    process.env.AUTH_TOKEN = newToken;
    authToken = newToken;
    tokenChanged = true;
    console.log('[Settings] AUTH_TOKEN updated');
  }

  if (body.allowedProjects !== undefined) {
    const newProjects = body.allowedProjects.trim();
    updateEnvFile('ALLOWED_PROJECTS', newProjects);
    process.env.ALLOWED_PROJECTS = newProjects;
    projectManager.reload();
    console.log('[Settings] ALLOWED_PROJECTS updated, reloaded project list');
  }

  return c.json({
    success: true,
    restartRequired: false,
    tokenChanged,
  });
});

// Permission endpoint - called by MCP permission server (localhost only, no auth)
app.post('/api/permission', async (c) => {
  const body = (await c.req.json()) as {
    toolName: string;
    toolInput: Record<string, unknown>;
  };

  // AskUserQuestion is handled interactively in the client UI — always allow it
  if (body.toolName === 'AskUserQuestion') {
    console.log('[Permission] Auto-allowed AskUserQuestion');
    return c.json({ granted: true });
  }

  // Check saved "Always Allow" patterns — if matched, grant immediately without prompting
  const projectDir = sessionManager.getProjectDir();
  if (projectDir && checkSavedPermission(projectDir, body.toolName, body.toolInput)) {
    console.log('[Permission] Auto-allowed by saved pattern:', body.toolName);
    return c.json({ granted: true });
  }

  if (!activeWs) {
    return c.json({ granted: false, reason: 'No client connected' }, 503);
  }

  const { id, promise } = permissionBridge.createRequest(
    body.toolName,
    body.toolInput,
  );

  // Send permission request to WebSocket client
  try {
    activeWs.send(
      JSON.stringify({
        type: 'permission_request',
        id,
        toolName: body.toolName,
        toolInput: body.toolInput,
      }),
    );
  } catch {
    return c.json({ granted: false, reason: 'Failed to send to client' }, 503);
  }

  // Wait for user response (or timeout)
  const granted = await promise;
  return c.json({ granted });
});

// -------------------------------------------------------
// Static file serving (production - serves client build)
// -------------------------------------------------------

app.use(
  '/*',
  serveStatic({ root: CLIENT_DIST }),
);

// SPA fallback: serve index.html for all non-API, non-WS routes
app.get('*', serveStatic({ root: CLIENT_DIST, path: 'index.html' }));

// -------------------------------------------------------
// Start server
// -------------------------------------------------------

const server = serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log('');
    console.log('===========================================');
    console.log('  Remote Claude Code Server');
    console.log('===========================================');
    console.log(`  URL:   http://localhost:${info.port}`);
    console.log(`  WS:    ws://localhost:${info.port}/ws`);
    console.log(`  Token: ${authToken}`);
    console.log('===========================================');
    console.log('');
    console.log(`  Projects: ${projectManager.listProjects().length} configured`);
    for (const p of projectManager.listProjects()) {
      console.log(`    - ${p.name} (${p.path})`);
    }
    console.log('');
  },
);

injectWebSocket(server);
