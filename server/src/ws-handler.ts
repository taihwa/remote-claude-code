// ============================================================
// WebSocket Handler - Routes client messages to server logic
// ============================================================

import type { WSContext } from 'hono/ws';
import type { ClientMessage, ServerMessage } from '@remote-claude/shared';
import type { SessionManager } from './session-manager.js';
import type { ProjectManager } from './project-manager.js';
import type { permissionBridge as PermissionBridgeType } from './permission-bridge.js';
import { derivePermissionPattern, addPermissionToSettings } from './settings-manager.js';

/**
 * Creates a send helper that serializes ServerMessage objects and
 * sends them over the WebSocket connection. Catches send errors
 * gracefully (e.g. when the connection has already closed).
 */
function createSender(ws: WSContext): (msg: ServerMessage) => void {
  return (msg: ServerMessage) => {
    try {
      ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error('[WS] Failed to send message:', (err as Error).message);
    }
  };
}

/**
 * Handle an incoming WebSocket text message.
 * Parses it as a ClientMessage and routes to the appropriate handler.
 */
export function handleWsMessage(
  ws: WSContext,
  raw: string | ArrayBuffer,
  sessionManager: SessionManager,
  projectManager: ProjectManager,
  bridge: typeof PermissionBridgeType,
): void {
  const send = createSender(ws);
  let message: ClientMessage;

  // Parse the incoming message
  const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
  try {
    message = JSON.parse(text) as ClientMessage;
  } catch {
    send({ type: 'error', message: 'Invalid JSON message' });
    return;
  }

  console.log(`[WS] Received: ${message.type}`);

  switch (message.type) {
    case 'create_session':
      handleCreateSession(message.prompt, message.projectDir, send, sessionManager, projectManager);
      break;

    case 'resume_session':
      handleResumeSession(message.prompt, message.sessionId, send, sessionManager, message.projectDir);
      break;

    case 'continue_session':
      handleContinueSession(message.prompt, send, sessionManager);
      break;

    case 'cancel':
      handleCancel(send, sessionManager);
      break;

    case 'list_projects':
      handleListProjects(send, projectManager);
      break;

    case 'permission_response':
      handlePermissionResponse(message, bridge, sessionManager);
      break;

    default:
      send({ type: 'error', message: `Unknown message type: ${(message as { type: string }).type}` });
  }
}

// -------------------------------------------------------
// Route handlers
// -------------------------------------------------------

async function handleCreateSession(
  prompt: string,
  projectDir: string,
  send: (msg: ServerMessage) => void,
  sessionManager: SessionManager,
  projectManager: ProjectManager,
): Promise<void> {
  // Validate the project directory
  const error = projectManager.validate(projectDir);
  if (error) {
    send({ type: 'error', message: error });
    return;
  }

  try {
    await sessionManager.startSession(prompt, projectDir, send);
  } catch (err) {
    send({
      type: 'error',
      message: `Failed to start session: ${(err as Error).message}`,
    });
  }
}

async function handleResumeSession(
  prompt: string,
  sessionId: string,
  send: (msg: ServerMessage) => void,
  sessionManager: SessionManager,
  projectDir?: string,
): Promise<void> {
  if (!sessionId) {
    send({ type: 'error', message: 'Session ID is required for resume' });
    return;
  }

  try {
    await sessionManager.resumeSession(prompt, sessionId, send, projectDir);
  } catch (err) {
    send({
      type: 'error',
      message: `Failed to resume session: ${(err as Error).message}`,
    });
  }
}

async function handleContinueSession(
  prompt: string,
  send: (msg: ServerMessage) => void,
  sessionManager: SessionManager,
): Promise<void> {
  try {
    await sessionManager.continueSession(prompt, send);
  } catch (err) {
    send({
      type: 'error',
      message: `Failed to continue session: ${(err as Error).message}`,
    });
  }
}

function handleCancel(
  send: (msg: ServerMessage) => void,
  sessionManager: SessionManager,
): void {
  if (!sessionManager.isActive()) {
    send({ type: 'error', message: 'No active session to cancel' });
    return;
  }
  sessionManager.cancel();
}

function handleListProjects(
  send: (msg: ServerMessage) => void,
  projectManager: ProjectManager,
): void {
  const projects = projectManager.listProjects();
  send({ type: 'projects', projects });
}

function handlePermissionResponse(
  message: { id: string; granted: boolean; alwaysAllow?: boolean },
  bridge: typeof PermissionBridgeType,
  sessionManager: SessionManager,
): void {
  if (message.alwaysAllow && message.granted) {
    const info = bridge.getRequestInfo(message.id);
    const projectDir = sessionManager.getProjectDir();

    if (info && projectDir) {
      const pattern = derivePermissionPattern(info.toolName, info.toolInput);
      try {
        addPermissionToSettings(projectDir, pattern);
      } catch (err) {
        console.error('[WS] Failed to save always-allow setting:', (err as Error).message);
      }
    }
  }

  bridge.resolveRequest(message.id, message.granted);
}
