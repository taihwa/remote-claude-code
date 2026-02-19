import { useState, useEffect } from 'react';

interface PermissionDialogProps {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  onRespond: (id: string, granted: boolean, alwaysAllow?: boolean) => void;
}

const TIMEOUT_SECONDS = 60;

function getToolBadge(name: string): { label: string; color: string } {
  const lower = name.toLowerCase();
  if (lower.includes('bash') || lower.includes('terminal'))
    return { label: 'Bash', color: 'bg-yellow-600' };
  if (lower.includes('read'))
    return { label: 'Read', color: 'bg-blue-600' };
  if (lower.includes('edit'))
    return { label: 'Edit', color: 'bg-purple-600' };
  if (lower.includes('write'))
    return { label: 'Write', color: 'bg-green-600' };
  if (lower.includes('glob'))
    return { label: 'Glob', color: 'bg-cyan-600' };
  if (lower.includes('grep') || lower.includes('search'))
    return { label: 'Search', color: 'bg-orange-600' };
  if (lower.includes('web') || lower.includes('fetch'))
    return { label: 'Web', color: 'bg-indigo-600' };
  return { label: name, color: 'bg-surface-600' };
}

function getKeySummary(toolName: string, input: Record<string, unknown>): string | null {
  const lower = toolName.toLowerCase();
  if ((lower.includes('bash') || lower.includes('terminal')) && input.command)
    return String(input.command);
  if (input.file_path) return String(input.file_path);
  if (input.pattern) return String(input.pattern);
  return null;
}

export default function PermissionDialog({
  id,
  toolName,
  toolInput,
  onRespond,
}: PermissionDialogProps) {
  const [expanded, setExpanded] = useState(false);
  const [remaining, setRemaining] = useState(TIMEOUT_SECONDS);

  useEffect(() => {
    setRemaining(TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onRespond(id, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [id, onRespond]);

  const badge = getToolBadge(toolName);
  const summary = getKeySummary(toolName, toolInput);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-surface-600 bg-surface-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
          <h2 className="text-sm font-semibold text-surface-100">
            Permission Required
          </h2>
          <span className="rounded-full bg-surface-700 px-2.5 py-0.5 text-xs font-mono text-surface-300">
            {remaining}s
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Tool badge + name */}
          <div className="flex items-center gap-2">
            <span
              className={`${badge.color} inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-white`}
            >
              {badge.label}
            </span>
            <span className="text-sm text-surface-300 font-mono">
              {toolName}
            </span>
          </div>

          {/* Key parameter */}
          {summary && (
            <div className="rounded-lg bg-surface-900/80 px-3 py-2">
              <pre className="text-sm text-surface-200 font-mono whitespace-pre-wrap break-all">
                {summary}
              </pre>
            </div>
          )}

          {/* Expandable full JSON */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
          >
            <span>{expanded ? '\u25BC' : '\u25B6'}</span>
            <span>Full input</span>
          </button>

          {expanded && (
            <div className="max-h-60 overflow-auto rounded-lg bg-surface-900/80 px-3 py-2">
              <pre className="text-xs text-surface-300 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(toolInput, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-surface-700 px-5 py-4">
          <button
            onClick={() => onRespond(id, false)}
            className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-900/60 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={() => onRespond(id, true)}
            className="flex-1 rounded-lg border border-surface-600 bg-surface-700 px-4 py-2 text-sm font-medium text-surface-200 hover:bg-surface-600 transition-colors"
          >
            Allow
          </button>
          <button
            onClick={() => onRespond(id, true, true)}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition-colors"
          >
            Always Allow
          </button>
        </div>

        {/* Timeout progress bar */}
        <div className="h-1 overflow-hidden rounded-b-xl bg-surface-700">
          <div
            className="h-full bg-primary-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(remaining / TIMEOUT_SECONDS) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
