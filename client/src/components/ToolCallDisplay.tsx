import { useState } from 'react';
import type { ToolUseBlock, ToolResultBlock } from '@remote-claude/shared';

// Tool icon/badge mapping
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
  if (lower.includes('notebook'))
    return { label: 'Notebook', color: 'bg-pink-600' };
  if (lower.includes('askuserquestion')) return { label: 'Question', color: 'bg-teal-600' };
  return { label: name, color: 'bg-surface-600' };
}

function getToolSummary(name: string, input: Record<string, unknown>): string | null {
  const lower = name.toLowerCase();
  if ((lower.includes('bash') || lower.includes('terminal')) && input.command) {
    return String(input.command);
  }
  if (lower.includes('read') && input.file_path) {
    return String(input.file_path);
  }
  if (lower.includes('edit') && input.file_path) {
    return String(input.file_path);
  }
  if (lower.includes('write') && input.file_path) {
    return String(input.file_path);
  }
  if (lower.includes('glob') && input.pattern) {
    return String(input.pattern);
  }
  if ((lower.includes('grep') || lower.includes('search')) && input.pattern) {
    return String(input.pattern);
  }
  if (lower.includes('askuserquestion') && Array.isArray(input.questions)) {
    const first = input.questions[0] as { header?: string; question?: string };
    return first?.header || first?.question || null;
  }
  return null;
}

function formatToolInput(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function formatToolResultContent(
  content: string | Array<{ type: string; text?: string }>,
): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (block.text) return block.text;
        return JSON.stringify(block);
      })
      .join('\n');
  }
  return String(content);
}

interface ToolCallProps {
  block: ToolUseBlock;
}

export function ToolCall({ block }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);
  const badge = getToolBadge(block.name);
  const summary = getToolSummary(block.name, block.input);

  return (
    <div className="my-2 rounded-lg border border-surface-700 bg-surface-900/50 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-800/50 transition-colors"
      >
        {/* Expand indicator */}
        <span className="text-surface-500 text-xs flex-shrink-0">
          {expanded ? '\u25BC' : '\u25B6'}
        </span>

        {/* Tool badge */}
        <span
          className={`${badge.color} inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-white flex-shrink-0`}
        >
          {badge.label}
        </span>

        {/* Summary */}
        {summary && (
          <span className="truncate font-mono text-xs text-surface-300">
            {summary}
          </span>
        )}

        {!summary && (
          <span className="text-xs text-surface-400">{block.name}</span>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-surface-700 px-3 py-2">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-surface-300 font-mono">
            {formatToolInput(block.input)}
          </pre>
        </div>
      )}
    </div>
  );
}

interface ToolResultProps {
  block: ToolResultBlock;
}

export function ToolResult({ block }: ToolResultProps) {
  const [expanded, setExpanded] = useState(false);
  const isError = block.is_error;
  const content = formatToolResultContent(block.content);
  const truncated = content.length > 200;
  const preview = truncated ? content.slice(0, 200) + '...' : content;

  if (!content.trim()) return null;

  return (
    <div
      className={`my-1 rounded-lg border overflow-hidden ${
        isError
          ? 'border-red-800/50 bg-red-950/30'
          : 'border-surface-700 bg-surface-900/30'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-800/30 transition-colors"
      >
        <span className="text-surface-500 flex-shrink-0">
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
        <span
          className={`font-medium ${isError ? 'text-red-400' : 'text-green-400'}`}
        >
          {isError ? 'Error' : 'Result'}
        </span>
        {!expanded && (
          <span className="truncate text-surface-500 font-mono">
            {preview}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-surface-700/50 px-3 py-2">
          <pre
            className={`overflow-x-auto whitespace-pre-wrap break-words text-xs font-mono ${
              isError ? 'text-red-300' : 'text-surface-300'
            }`}
          >
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
