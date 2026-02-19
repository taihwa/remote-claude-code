import { useState, useEffect } from 'react';
import type { SessionInfo } from '@remote-claude/shared';
import { useChatStore } from '../stores/chatStore';

interface SessionSidebarProps {
  currentSessionId: string | null;
  onNewSession: (projectDir: string) => void;
  onResumeSession: (sessionId: string) => void;
  onLogout: () => void;
}

const HISTORY_KEY = 'rcc-session-history';

function loadHistory(): SessionInfo[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as SessionInfo[];
  } catch {
    // ignore
  }
  return [];
}

function saveHistory(history: SessionInfo[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch {
    // ignore
  }
}

function getProjectName(projectDir: string): string {
  if (!projectDir) return 'Unknown';
  const parts = projectDir.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || projectDir;
}

function formatSessionLabel(session: SessionInfo) {
  const projectName = getProjectName(session.projectDir);
  const shortId = session.sessionId.slice(0, 8);
  const date = new Date(session.createdAt).toLocaleDateString();
  return { projectName, shortId, date };
}

export default function SessionSidebar({
  currentSessionId,
  onNewSession,
  onResumeSession,
  onLogout,
}: SessionSidebarProps) {
  const projectDir = useChatStore((s) => s.projectDir);
  const projects = useChatStore((s) => s.projects);
  const clearSession = useChatStore((s) => s.clearSession);
  const [history, setHistory] = useState<SessionInfo[]>(loadHistory);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // Save current session to history
  useEffect(() => {
    if (currentSessionId) {
      setHistory((prev) => {
        const exists = prev.find((s) => s.sessionId === currentSessionId);
        if (exists) {
          // Update projectDir if it was previously empty
          if (!exists.projectDir && projectDir) {
            const updated = prev.map((s) =>
              s.sessionId === currentSessionId
                ? { ...s, projectDir }
                : s,
            );
            saveHistory(updated);
            return updated;
          }
          return prev;
        }
        const projName = getProjectName(projectDir || '');
        const shortId = currentSessionId.slice(0, 8);
        const updated = [
          {
            sessionId: currentSessionId,
            projectDir: projectDir || '',
            title: `${projName} ${shortId}`,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
        saveHistory(updated);
        return updated;
      });
    }
  }, [currentSessionId, projectDir]);

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Remove from localStorage messages
    try {
      localStorage.removeItem(`rcc-messages-${sessionId}`);
    } catch {
      // ignore
    }
    // Remove from history
    setHistory((prev) => {
      const updated = prev.filter((s) => s.sessionId !== sessionId);
      saveHistory(updated);
      return updated;
    });
    // If deleting the active session, clear it
    if (sessionId === currentSessionId) {
      clearSession();
      useChatStore.setState({ projectDir: null });
    }
  };

  const handleProjectSelect = (path: string) => {
    setShowProjectPicker(false);
    onNewSession(path);
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-surface-700 bg-surface-900">
      {/* Header */}
      <div className="border-b border-surface-700 p-4">
        <h1 className="mb-3 text-sm font-semibold text-surface-300 uppercase tracking-wider">
          Sessions
        </h1>
        {showProjectPicker ? (
          <div className="space-y-1">
            <p className="text-xs text-surface-400 mb-2">Select project:</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {projects.map((proj) => (
                <button
                  key={proj.path}
                  onClick={() => handleProjectSelect(proj.path)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-surface-200 hover:bg-surface-700 transition-colors truncate"
                  title={proj.path}
                >
                  {proj.name}
                </button>
              ))}
            </div>
            {projects.length === 0 && (
              <p className="text-xs text-surface-500 py-2 text-center">
                No projects available
              </p>
            )}
            <button
              onClick={() => setShowProjectPicker(false)}
              className="w-full mt-1 rounded-md px-2 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowProjectPicker(true)}
            className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-200 transition-colors hover:bg-surface-700 hover:border-surface-500"
          >
            + New Session
          </button>
        )}
      </div>

      {/* Session history */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Pending new session indicator */}
        {!currentSessionId && projectDir && (
          <div className="mb-1 w-full rounded-lg px-3 py-2 text-left text-sm bg-primary-600/10 text-primary-300 border border-primary-600/20">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-400 animate-pulse" />
              <span className="truncate font-medium">{getProjectName(projectDir)}</span>
            </div>
            <div className="mt-0.5 text-xs text-surface-500">
              Waiting for first message...
            </div>
          </div>
        )}
        {history.length === 0 && !projectDir && (
          <p className="px-2 py-4 text-center text-xs text-surface-500">
            No session history
          </p>
        )}
        {history.map((session) => {
          const { projectName, shortId, date } = formatSessionLabel(session);
          return (
            <div
              key={session.sessionId}
              className="group relative mb-1"
            >
              <button
                onClick={() => onResumeSession(session.sessionId)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  session.sessionId === currentSessionId
                    ? 'bg-primary-600/20 text-primary-300 border border-primary-600/30'
                    : 'text-surface-300 hover:bg-surface-800'
                }`}
              >
                <div className="truncate font-medium pr-5">
                  {projectName}
                </div>
                <div className="mt-0.5 text-xs text-surface-500 truncate">
                  {shortId} · {date}
                </div>
              </button>
              {/* Delete button */}
              <button
                onClick={(e) => handleDeleteSession(session.sessionId, e)}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-colors"
                title="Delete session"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-surface-700 p-4 space-y-1">
        <button
          onClick={() => useChatStore.getState().setView('settings')}
          className="w-full rounded-lg px-3 py-2 text-sm text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
        >
          Settings
        </button>
        <button
          onClick={onLogout}
          className="w-full rounded-lg px-3 py-2 text-sm text-surface-400 transition-colors hover:bg-surface-800 hover:text-red-400"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
