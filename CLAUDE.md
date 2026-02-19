# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Remote Claude Code (RCC) is a web-based UI for running Claude Code CLI remotely. It spawns `claude` CLI as a subprocess on a server, streams NDJSON output over WebSocket to a React frontend, and relays permission prompts back to the user via a custom MCP permission server.

## Commands

```bash
# Development (starts both server and client concurrently)
npm run dev

# Server only (tsx watch, port 3456)
npm run dev:server

# Client only (Vite dev server, port 5173, proxies /ws and /api to 3456)
npm run dev:client

# Production build (builds shared types first, then client)
npm run build

# Production start (serves built client + API from single server)
npm start
```

## Architecture

**Monorepo** with npm workspaces: `shared/`, `server/`, `client/`.

### shared (`@remote-claude/shared`)
TypeScript-only package defining the WebSocket protocol types. All message types (client→server and server→client) and CLI stream event types live in `shared/src/protocol.ts`. Must be built (`tsc`) before client build since client imports from `dist/`.

### server (`@remote-claude/server`)
Hono HTTP server with WebSocket support (`@hono/node-ws`). Key modules:
- **`session-manager.ts`** — Spawns `claude` CLI as a child process with `--output-format stream-json`. Only one session runs at a time. Supports create, resume (by session ID), and continue modes.
- **`stream-parser.ts`** — NDJSON parser that reads CLI stdout line-by-line and emits typed `CliStreamEvent` objects.
- **`ws-handler.ts`** — Routes incoming `ClientMessage` WebSocket messages to session/project handlers.
- **`project-manager.ts`** — Validates project directories against `ALLOWED_PROJECTS` env var. Supports `/*` suffix to auto-expand subdirectories.
- **`mcp-permission-server.ts`** — Standalone MCP server (stdio JSON-RPC) spawned alongside each CLI session via `--permission-prompt-tool`. Relays permission checks to the main server over HTTP.
- **`permission-bridge.ts`** — Promise-based bridge connecting MCP HTTP permission requests with WebSocket client responses. 60s timeout, auto-deny.
- **`auth.ts`** — Bearer token auth for API routes, query-param auth for WebSocket. Auto-generates and persists token to `.env` on first run.

### client (`@remote-claude/client`)
React 19 + Vite + Tailwind CSS v4. State management via Zustand (single store in `stores/chatStore.ts`).
- **`hooks/useWebSocket.ts`** — WebSocket connection with auto-reconnect and exponential backoff.
- **`hooks/useSession.ts`** — Session lifecycle (create/resume/continue/cancel) and message sending.
- **`components/ChatView.tsx`** — Main chat interface with project selector and input bar.
- **`components/PermissionDialog.tsx`** — Modal for approving/denying CLI tool permission requests.
- Sessions are persisted to `localStorage` keyed by `rcc-messages-{sessionId}`.

### Permission Flow
CLI tool call → MCP permission server (stdio) → HTTP POST `/api/permission` → WebSocket `permission_request` to client → user approves/denies → WebSocket `permission_response` → HTTP response → MCP response → CLI proceeds or aborts.

## Environment

Config via `.env` at project root (auto-created on first start if missing):
- `AUTH_TOKEN` — Bearer token for API auth (auto-generated if not set)
- `PORT` — Server port (default: 3456)
- `ALLOWED_PROJECTS` — Comma-separated absolute paths; use `/*` suffix to include all subdirs (e.g., `/Users/me/projects/*`)
