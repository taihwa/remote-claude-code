// ============================================================
// Session Manager - Manages Claude Code CLI subprocess
// ============================================================

import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ServerMessage,
  CliStreamEvent,
  CliSystemInit,
} from '@remote-claude/shared';
import { StreamParser } from './stream-parser.js';
import type { MessageCallback, ActiveSession, SpawnConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Manages a single active Claude Code CLI process.
 *
 * Design: Only one process runs at a time (personal use tool).
 * The session manager spawns the CLI, parses its NDJSON output,
 * and forwards parsed messages to the connected WebSocket client.
 */
export class SessionManager {
  private activeProcess: ChildProcess | null = null;
  private currentSessionId: string | null = null;
  private currentProjectDir: string | null = null;
  private parser: StreamParser | null = null;
  private port: number;
  private mcpConfigPath: string;

  constructor(port: number) {
    this.port = port;

    // Create MCP config file for permission server
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'rcc-'));
    this.mcpConfigPath = path.join(tmpDir, 'mcp-config.json');
    const mcpServerScript = path.resolve(__dirname, 'mcp-permission-server.ts');
    const tsxBin = path.resolve(__dirname, '../../../node_modules/.bin/tsx');
    const mcpConfig = {
      mcpServers: {
        permission: {
          command: tsxBin,
          args: [mcpServerScript],
          env: { RCC_PORT: String(port) },
        },
      },
    };
    writeFileSync(this.mcpConfigPath, JSON.stringify(mcpConfig));
    console.log(`[SessionManager] MCP config written to ${this.mcpConfigPath}`);
  }

  /**
   * Start a new Claude session with the given prompt and project directory.
   */
  async startSession(
    prompt: string,
    projectDir: string,
    onMessage: MessageCallback,
  ): Promise<void> {
    this.ensureNoActiveProcess(onMessage);

    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--max-turns', '50',
      '--permission-prompt-tool', 'mcp__permission__check_permission',
      '--mcp-config', this.mcpConfigPath,
    ];

    this.spawnProcess(args, projectDir, onMessage);
  }

  /**
   * Resume an existing session by its session ID.
   * If the CLI session doesn't exist (exit code 1), falls back to creating a new session.
   */
  async resumeSession(
    prompt: string,
    sessionId: string,
    onMessage: MessageCallback,
    projectDir?: string,
  ): Promise<void> {
    this.ensureNoActiveProcess(onMessage);

    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--resume', sessionId,
      '--permission-prompt-tool', 'mcp__permission__check_permission',
      '--mcp-config', this.mcpConfigPath,
    ];

    this.spawnProcess(args, projectDir, onMessage, {
      fallbackOnFailure: projectDir ? { prompt, projectDir } : undefined,
    });
  }

  /**
   * Continue the most recent session.
   */
  async continueSession(
    prompt: string,
    onMessage: MessageCallback,
  ): Promise<void> {
    this.ensureNoActiveProcess(onMessage);

    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--continue',
      '--permission-prompt-tool', 'mcp__permission__check_permission',
      '--mcp-config', this.mcpConfigPath,
    ];

    this.spawnProcess(args, undefined, onMessage);
  }

  /**
   * Cancel the currently running process by sending SIGINT.
   */
  cancel(): void {
    if (this.activeProcess) {
      console.log('[SessionManager] Sending SIGINT to active process');
      this.activeProcess.kill('SIGINT');
    }
  }

  /**
   * Check whether a CLI process is currently running.
   */
  isActive(): boolean {
    return this.activeProcess !== null;
  }

  /**
   * Get the current session ID (extracted from CLI init message).
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get the current project directory for the active session.
   */
  getProjectDir(): string | null {
    return this.currentProjectDir;
  }

  // -------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------

  /**
   * If a process is already running, kill it and notify the client.
   */
  private ensureNoActiveProcess(onMessage: MessageCallback): void {
    if (this.activeProcess) {
      console.log('[SessionManager] Killing existing process before starting new one');
      this.activeProcess.kill('SIGTERM');
      this.activeProcess = null;
      this.parser = null;
    }
  }

  /**
   * Spawn the Claude CLI process with the given arguments.
   * Sets up NDJSON stream parsing on stdout and handles lifecycle events.
   *
   * If `options.fallbackOnFailure` is provided and the process exits with a
   * non-zero code without having produced any stream output, a new session
   * will be started instead (used when `--resume` fails because the CLI
   * session no longer exists).
   */
  private spawnProcess(
    args: string[],
    projectDir: string | undefined,
    onMessage: MessageCallback,
    options?: { fallbackOnFailure?: { prompt: string; projectDir: string } },
  ): void {
    console.log('[SessionManager] Spawning: claude', args.join(' '));

    // Build clean environment: remove keys that interfere with child Claude CLI
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRY_POINT;

    const proc = spawn('claude', args, {
      cwd: projectDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.activeProcess = proc;
    this.currentProjectDir = projectDir ?? null;
    let receivedOutput = false;

    // Capture stderr for debugging
    let stderrOutput = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrOutput += text;
      console.error('[CLI stderr]', text.trimEnd());
    });

    // Parse NDJSON from stdout
    if (proc.stdout) {
      this.parser = new StreamParser(
        proc.stdout,
        (event: CliStreamEvent) => {
          receivedOutput = true;
          this.handleStreamEvent(event, onMessage);
        },
        (error: Error) => {
          console.error('[StreamParser] Error:', error.message);
        },
      );
    }

    // Handle process exit
    proc.on('close', (code, signal) => {
      console.log(`[SessionManager] Process exited: code=${code}, signal=${signal}`);
      this.activeProcess = null;
      this.currentProjectDir = null;
      this.parser = null;

      // Fallback: if resume failed (non-zero exit, no output), start a new session
      if (code !== 0 && !receivedOutput && options?.fallbackOnFailure) {
        const { prompt, projectDir: fallbackDir } = options.fallbackOnFailure;
        console.log('[SessionManager] Resume failed, falling back to new session');
        this.startSession(prompt, fallbackDir, onMessage);
        return;
      }

      onMessage({
        type: 'turn_complete',
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      console.error('[SessionManager] Process error:', err.message);
      this.activeProcess = null;
      this.parser = null;

      onMessage({
        type: 'error',
        message: `Failed to start Claude CLI: ${err.message}`,
      });
    });
  }

  /**
   * Handle a parsed stream event from the CLI.
   * Extracts session ID from init messages and forwards everything to the client.
   */
  private handleStreamEvent(
    event: CliStreamEvent,
    onMessage: MessageCallback,
  ): void {
    // Extract session ID from the system init message
    if (event.type === 'system' && event.subtype === 'init') {
      const initEvent = event as CliSystemInit;
      this.currentSessionId = initEvent.session_id;
      console.log(`[SessionManager] Session ID: ${this.currentSessionId}`);

      // Notify client that the session was created
      onMessage({
        type: 'session_created',
        sessionId: initEvent.session_id,
      });
    }

    // Forward every stream event to the client
    onMessage({
      type: 'stream_event',
      data: event,
    });
  }
}
