// ============================================================
// Settings Manager - Manages .claude/settings.local.json for
// persisting "Always Allow" permission patterns
// ============================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

interface SettingsFile {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  [key: string]: unknown;
}

/**
 * Normalize toolInput — if it's a JSON string, parse it to an object.
 */
function normalizeToolInput(
  toolInput: Record<string, unknown> | string | unknown,
): Record<string, unknown> {
  if (typeof toolInput === 'string') {
    try {
      const parsed = JSON.parse(toolInput);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not valid JSON
    }
    return {};
  }
  return (toolInput || {}) as Record<string, unknown>;
}

/**
 * Derive a permission pattern string from a tool name and its input.
 *
 * Examples:
 *   Bash + { command: "mkdir foo" }  → "Bash(mkdir:*)"
 *   WebFetch + { url: "https://example.com/path" } → "WebFetch(domain:example.com)"
 *   Read + { file_path: "/some/file" } → "Read"
 */
export function derivePermissionPattern(
  toolName: string,
  toolInput: Record<string, unknown> | string | unknown,
): string {
  const input = normalizeToolInput(toolInput);
  console.log('[SettingsManager] derivePattern:', toolName, JSON.stringify(input));

  if (toolName === 'Bash' && typeof input.command === 'string') {
    const firstWord = input.command.trim().split(/\s+/)[0];
    if (firstWord) return `Bash(${firstWord}:*)`;
  }

  if (toolName === 'WebFetch' && typeof input.url === 'string') {
    try {
      const domain = new URL(input.url).hostname;
      if (domain) return `WebFetch(domain:${domain})`;
    } catch {
      // Invalid URL — fall through to default
    }
  }

  return toolName;
}

/**
 * Load the allow list from a project's `.claude/settings.local.json`.
 */
function loadAllowList(projectDir: string): string[] {
  const settingsPath = path.join(projectDir, '.claude', 'settings.local.json');
  try {
    const raw = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as SettingsFile;
    return Array.isArray(settings.permissions?.allow)
      ? settings.permissions!.allow
      : [];
  } catch {
    return [];
  }
}

/**
 * Check if a tool request matches any saved "Always Allow" pattern.
 *
 * Matching logic:
 *   - Exact match: saved pattern === toolName (e.g., "Write" matches "Write")
 *   - Bash pattern: "Bash(cmd:*)" matches if the request's first command word is "cmd"
 *   - WebFetch pattern: "WebFetch(domain:xxx)" matches if the request URL's hostname is "xxx"
 */
export function checkSavedPermission(
  projectDir: string,
  toolName: string,
  toolInput: Record<string, unknown> | string | unknown,
): boolean {
  const allowList = loadAllowList(projectDir);
  if (allowList.length === 0) return false;

  const input = normalizeToolInput(toolInput);
  const currentPattern = derivePermissionPattern(toolName, input);

  for (const saved of allowList) {
    // Exact match (covers both simple tool names and full patterns)
    if (saved === currentPattern) {
      console.log(`[SettingsManager] Pattern matched (exact): ${saved}`);
      return true;
    }

    // Simple tool name match (e.g., saved "Bash" matches any Bash request)
    if (saved === toolName) {
      console.log(`[SettingsManager] Pattern matched (tool name): ${saved}`);
      return true;
    }

    // Bash prefix match: saved "Bash(mkdir:*)" matches current Bash command starting with "mkdir"
    const bashMatch = saved.match(/^Bash\((\w+):\*\)$/);
    if (bashMatch && toolName === 'Bash' && typeof input.command === 'string') {
      const savedCmd = bashMatch[1];
      const requestCmd = input.command.trim().split(/\s+/)[0];
      if (savedCmd === requestCmd) {
        console.log(`[SettingsManager] Pattern matched (Bash cmd): ${saved}`);
        return true;
      }
    }

    // WebFetch domain match: saved "WebFetch(domain:xxx)" matches current URL with hostname xxx
    const webMatch = saved.match(/^WebFetch\(domain:(.+)\)$/);
    if (webMatch && toolName === 'WebFetch' && typeof input.url === 'string') {
      try {
        const savedDomain = webMatch[1];
        const requestDomain = new URL(input.url as string).hostname;
        if (savedDomain === requestDomain) {
          console.log(`[SettingsManager] Pattern matched (WebFetch domain): ${saved}`);
          return true;
        }
      } catch {
        // Invalid URL — no match
      }
    }
  }

  return false;
}

/**
 * Add a permission pattern to the project's `.claude/settings.local.json`.
 * Creates the file and directory if they don't exist.
 * Skips silently if the pattern is already present.
 */
export function addPermissionToSettings(
  projectDir: string,
  pattern: string,
): void {
  const claudeDir = path.join(projectDir, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.local.json');

  let settings: SettingsFile = {};
  try {
    const raw = readFileSync(settingsPath, 'utf-8');
    settings = JSON.parse(raw) as SettingsFile;
  } catch {
    // File doesn't exist or is malformed — start fresh
  }

  if (!settings.permissions) {
    settings.permissions = {};
  }
  if (!Array.isArray(settings.permissions.allow)) {
    settings.permissions.allow = [];
  }

  // Skip if already present
  if (settings.permissions.allow.includes(pattern)) {
    return;
  }

  settings.permissions.allow.push(pattern);

  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log(`[SettingsManager] Added permission pattern: ${pattern}`);
}
