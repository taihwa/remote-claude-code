#!/usr/bin/env node
// ============================================================
// MCP Permission Server - Standalone MCP server for Claude CLI
// permission delegation via --permission-prompt-tool
//
// Communicates with Claude CLI over stdio (JSON-RPC 2.0)
// and relays permission requests to the main server via HTTP.
// ============================================================

import { createInterface } from 'node:readline';

const PORT = process.env.RCC_PORT || '3456';
const BASE_URL = `http://localhost:${PORT}`;

// -------------------------------------------------------
// JSON-RPC helpers
// -------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

function sendResponse(id: number | string, result: unknown): void {
  const response = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(response + '\n');
}

function sendError(id: number | string, code: number, message: string): void {
  const response = JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
  process.stdout.write(response + '\n');
}

// -------------------------------------------------------
// MCP Protocol Handlers
// -------------------------------------------------------

function handleInitialize(id: number | string): void {
  sendResponse(id, {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    serverInfo: {
      name: 'rcc-permission-server',
      version: '1.0.0',
    },
  });
}

function handleToolsList(id: number | string): void {
  sendResponse(id, {
    tools: [
      {
        name: 'check_permission',
        description: 'Check if a tool use is permitted',
        inputSchema: {
          type: 'object',
          properties: {
            tool_name: { type: 'string' },
            tool_input: { type: 'object' },
          },
        },
      },
    ],
  });
}

async function handleToolsCall(
  id: number | string,
  params: Record<string, unknown>,
): Promise<void> {
  const toolName = params.name as string;

  if (toolName !== 'check_permission') {
    sendError(id, -32602, `Unknown tool: ${toolName}`);
    return;
  }

  const args = (params.arguments || {}) as Record<string, unknown>;
  const requestedTool = (args.tool_name || '') as string;

  // tool_input may arrive as a JSON string — parse it to an object
  let requestedInput: Record<string, unknown>;
  const rawInput = args.tool_input;
  if (typeof rawInput === 'string') {
    try {
      requestedInput = JSON.parse(rawInput) as Record<string, unknown>;
    } catch {
      requestedInput = {};
    }
  } else {
    requestedInput = (rawInput || {}) as Record<string, unknown>;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: requestedTool,
        toolInput: requestedInput,
      }),
    });

    if (!response.ok) {
      // Server error → deny
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              behavior: 'deny',
              message: `Permission server returned ${response.status}`,
            }),
          },
        ],
      });
      return;
    }

    const result = (await response.json()) as { granted: boolean };

    if (result.granted) {
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              behavior: 'allow',
              updatedInput: requestedInput,
            }),
          },
        ],
      });
    } else {
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              behavior: 'deny',
              message: 'User denied permission',
            }),
          },
        ],
      });
    }
  } catch (err) {
    // Network error → deny
    sendResponse(id, {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            behavior: 'deny',
            message: `Failed to reach permission server: ${(err as Error).message}`,
          }),
        },
      ],
    });
  }
}

// -------------------------------------------------------
// Main: Read JSON-RPC messages from stdin
// -------------------------------------------------------

const rl = createInterface({ input: process.stdin });

rl.on('line', async (line: string) => {
  if (!line.trim()) return;

  let request: JsonRpcRequest;
  try {
    request = JSON.parse(line) as JsonRpcRequest;
  } catch {
    return;
  }

  // Notifications (no id) — just acknowledge
  if (request.id === undefined || request.id === null) {
    return;
  }

  switch (request.method) {
    case 'initialize':
      handleInitialize(request.id);
      break;
    case 'tools/list':
      handleToolsList(request.id);
      break;
    case 'tools/call':
      await handleToolsCall(request.id, (request.params || {}) as Record<string, unknown>);
      break;
    default:
      sendError(request.id, -32601, `Method not found: ${request.method}`);
  }
});

rl.on('close', () => {
  process.exit(0);
});
