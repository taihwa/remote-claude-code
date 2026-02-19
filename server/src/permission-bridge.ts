// ============================================================
// Permission Bridge - Connects MCP HTTP requests with WebSocket
// client responses for permission relay
// ============================================================

import { randomUUID } from 'node:crypto';

interface PendingRequest {
  resolve: (granted: boolean) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  toolName: string;
  toolInput: Record<string, unknown>;
}

const TIMEOUT_MS = 60_000;

class PermissionBridge {
  private pending = new Map<string, PendingRequest>();

  /**
   * Create a permission request and return a Promise that resolves
   * when the user responds (or rejects on timeout).
   */
  createRequest(toolName: string, toolInput: Record<string, unknown>): { id: string; promise: Promise<boolean> } {
    const id = randomUUID();

    const promise = new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(false); // Auto-deny on timeout
      }, TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer, toolName, toolInput });
    });

    return { id, promise };
  }

  /**
   * Get tool info for a pending request (must be called before resolveRequest).
   */
  getRequestInfo(id: string): { toolName: string; toolInput: Record<string, unknown> } | null {
    const entry = this.pending.get(id);
    if (!entry) return null;
    return { toolName: entry.toolName, toolInput: entry.toolInput };
  }

  /**
   * Resolve a pending permission request with the user's decision.
   */
  resolveRequest(id: string, granted: boolean): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(id);
    entry.resolve(granted);
  }

  /**
   * Clean up all pending requests (e.g. on shutdown).
   */
  cleanup(): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.resolve(false);
    }
    this.pending.clear();
  }
}

export const permissionBridge = new PermissionBridge();
