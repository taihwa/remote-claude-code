// ============================================================
// Project Manager - Manages allowed project directories
// ============================================================

import path from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import type { ProjectInfo } from '@remote-claude/shared';

/**
 * Manages the list of allowed project directories.
 *
 * Reads from the ALLOWED_PROJECTS environment variable (comma-separated paths).
 * Supports glob-like `/*` suffix to include all subdirectories of a path.
 * Example: /Users/me/study/* expands to all directories inside /Users/me/study/
 */
export class ProjectManager {
  private allowedProjects: string[];

  constructor() {
    this.allowedProjects = [];
    this.reload();
  }

  /**
   * Re-parse ALLOWED_PROJECTS from process.env and rebuild the project list.
   * Called on construction and when settings are updated at runtime.
   */
  reload() {
    const raw = process.env.ALLOWED_PROJECTS || '';
    const entries = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    this.allowedProjects = [];

    for (const entry of entries) {
      if (entry.endsWith('/*')) {
        // Expand: scan subdirectories
        const parentDir = path.resolve(entry.slice(0, -2));
        try {
          const children = readdirSync(parentDir, { withFileTypes: true });
          for (const child of children) {
            if (child.isDirectory() && !child.name.startsWith('.')) {
              this.allowedProjects.push(path.join(parentDir, child.name));
            }
          }
        } catch (err) {
          console.warn(
            `[ProjectManager] Could not scan directory ${parentDir}: ${(err as Error).message}`,
          );
        }
      } else {
        this.allowedProjects.push(path.resolve(entry));
      }
    }

    this.allowedProjects.sort();

    if (this.allowedProjects.length === 0) {
      console.warn(
        '[ProjectManager] WARNING: No ALLOWED_PROJECTS configured. ' +
        'Set ALLOWED_PROJECTS in .env (comma-separated absolute paths, use /* to scan subdirs).',
      );
    }
  }

  /**
   * List all allowed projects with their names (directory basename).
   */
  listProjects(): ProjectInfo[] {
    return this.allowedProjects.map((p) => ({
      path: p,
      name: path.basename(p),
    }));
  }

  /**
   * Check whether a given project directory is in the allowed list.
   */
  isAllowed(projectDir: string): boolean {
    const resolved = path.resolve(projectDir);
    return this.allowedProjects.some(
      (allowed) => resolved === allowed || resolved.startsWith(allowed + path.sep),
    );
  }

  /**
   * Validate a project directory and return an error message if invalid,
   * or null if it is valid.
   */
  validate(projectDir: string): string | null {
    if (!projectDir) {
      return 'Project directory is required';
    }
    if (!this.isAllowed(projectDir)) {
      return `Project directory not allowed: ${projectDir}`;
    }
    return null;
  }
}
