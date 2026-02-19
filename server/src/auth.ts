// ============================================================
// Auth - Simple Bearer token authentication
// ============================================================

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Context, Next } from 'hono';

/** Path to the .env file at the project root (server/src → server → project root). */
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

/**
 * Resolve the auth token:
 * 1. If AUTH_TOKEN is set in the environment, use it.
 * 2. Otherwise, generate a random token and persist it to .env.
 */
export function resolveAuthToken(): string {
  if (process.env.AUTH_TOKEN) {
    return process.env.AUTH_TOKEN;
  }

  // Try to read from .env file in case it was written before but not loaded
  try {
    if (existsSync(ENV_PATH)) {
      const content = readFileSync(ENV_PATH, 'utf-8');
      const match = content.match(/^AUTH_TOKEN=(.+)$/m);
      if (match) {
        const token = match[1].trim();
        process.env.AUTH_TOKEN = token;
        return token;
      }
    }
  } catch {
    // Ignore read errors
  }

  // Generate a new token
  const token = randomBytes(32).toString('hex');
  console.log('[Auth] Generated new auth token');

  // Persist to .env
  try {
    const line = `AUTH_TOKEN=${token}\n`;
    if (existsSync(ENV_PATH)) {
      appendFileSync(ENV_PATH, line);
    } else {
      writeFileSync(ENV_PATH, line);
    }
    console.log(`[Auth] Saved token to ${ENV_PATH}`);
  } catch (err) {
    console.warn('[Auth] Could not save token to .env:', (err as Error).message);
  }

  process.env.AUTH_TOKEN = token;
  return token;
}

/**
 * Hono middleware that checks for a valid Bearer token in the
 * Authorization header.
 *
 * Skips auth for WebSocket upgrade requests (those are checked
 * via query parameter in the ws-handler).
 */
export function authMiddleware(authToken: string) {
  return async (c: Context, next: Next) => {
    // Skip auth for WebSocket upgrade (handled by query param instead)
    const upgrade = c.req.header('upgrade');
    if (upgrade?.toLowerCase() === 'websocket') {
      return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Authorization header required' }, 401);
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== authToken) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    return next();
  };
}

/**
 * Validate a WebSocket token from query parameters.
 */
export function validateWsToken(token: string | undefined, authToken: string): boolean {
  if (!token) return false;
  return token === authToken;
}
