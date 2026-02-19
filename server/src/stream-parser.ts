// ============================================================
// NDJSON Stream Parser for Claude CLI stdout
// ============================================================

import type { Readable } from 'node:stream';
import type { CliStreamEvent } from '@remote-claude/shared';
import type { StreamEventCallback } from './types.js';

/**
 * Parses newline-delimited JSON (NDJSON) from a Node.js Readable stream.
 *
 * The Claude CLI with --output-format stream-json emits one JSON object
 * per line on stdout. This parser handles:
 * - Lines split across multiple chunks (buffering)
 * - Empty lines (skipped)
 * - Non-JSON lines such as debug output (skipped)
 */
export class StreamParser {
  private buffer = '';

  constructor(
    stream: Readable,
    private onMessage: StreamEventCallback,
    private onError?: (error: Error) => void,
  ) {
    stream.on('data', (chunk: Buffer) => {
      this.processChunk(chunk.toString());
    });

    stream.on('error', (err) => {
      this.onError?.(err);
    });

    stream.on('end', () => {
      // Process any remaining data in the buffer
      this.flushBuffer();
    });
  }

  /**
   * Process a chunk of data from the stream, splitting on newlines
   * and keeping any incomplete trailing line in the buffer.
   */
  private processChunk(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');

    // The last element is either an incomplete line or empty string.
    // Keep it in the buffer for the next chunk.
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this.parseLine(line);
    }
  }

  /**
   * Flush any remaining buffered data when the stream ends.
   */
  private flushBuffer(): void {
    if (this.buffer.trim()) {
      this.parseLine(this.buffer);
      this.buffer = '';
    }
  }

  /**
   * Attempt to parse a single line as JSON and emit it.
   */
  private parseLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed) as CliStreamEvent;
      this.onMessage(parsed);
    } catch {
      // Non-JSON output from CLI (e.g. debug messages) - skip silently
    }
  }
}
