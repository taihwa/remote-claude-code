// ============================================================
// Internal Server Types - Extends shared protocol
// ============================================================

import type { ChildProcess } from 'node:child_process';
import type { ServerMessage, CliStreamEvent, SessionInfo } from '@remote-claude/shared';

/**
 * Callback for forwarding server messages to the connected client.
 */
export type MessageCallback = (msg: ServerMessage) => void;

/**
 * Internal representation of an active CLI session.
 */
export interface ActiveSession {
  process: ChildProcess;
  sessionId: string | null;
  projectDir: string;
  startedAt: number;
}

/**
 * Configuration for spawning a CLI process.
 */
export interface SpawnConfig {
  prompt: string;
  projectDir?: string;
  sessionId?: string;
  mode: 'create' | 'resume' | 'continue';
}

/**
 * Server configuration loaded from environment.
 */
export interface ServerConfig {
  port: number;
  authToken: string;
  allowedProjects: string[];
}

/**
 * Callback for the stream parser when a JSON event is parsed.
 */
export type StreamEventCallback = (event: CliStreamEvent) => void;
