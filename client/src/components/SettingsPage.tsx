import { useState, useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';

interface SettingsData {
  authToken: string;
  allowedProjects: string;
  port: number;
}

export default function SettingsPage() {
  const token = useChatStore((s) => s.token);
  const setToken = useChatStore((s) => s.setToken);
  const setView = useChatStore((s) => s.setView);
  const isConnected = useChatStore((s) => s.isConnected);

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth Token fields
  const [showToken, setShowToken] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Allowed Projects fields
  const [projectsValue, setProjectsValue] = useState('');
  const [projectsSaving, setProjectsSaving] = useState(false);
  const [projectsMessage, setProjectsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiFetch = async (path: string, options?: RequestInit) => {
    return fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/settings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SettingsData;
      setSettings(data);
      setProjectsValue(data.allowedProjects);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToken = async () => {
    if (!newToken.trim()) return;
    setTokenSaving(true);
    setTokenMessage(null);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ authToken: newToken.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Update client token to the new one
      setToken(newToken.trim());
      setSettings((prev) => prev ? { ...prev, authToken: newToken.trim() } : prev);
      setNewToken('');
      setTokenMessage({ type: 'success', text: 'Token updated. Client token refreshed.' });
    } catch (err) {
      setTokenMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setTokenSaving(false);
    }
  };

  const handleSaveProjects = async () => {
    setProjectsSaving(true);
    setProjectsMessage(null);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ allowedProjects: projectsValue.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSettings((prev) => prev ? { ...prev, allowedProjects: projectsValue.trim() } : prev);
      setProjectsMessage({ type: 'success', text: 'Allowed projects updated. Project list reloaded.' });
    } catch (err) {
      setProjectsMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setProjectsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-900">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => setView('chat')}
            className="rounded-lg px-3 py-2 text-sm text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
          >
            &larr; Back to Chat
          </button>
          <h1 className="text-lg font-semibold text-white">Settings</h1>
        </div>

        {loading && (
          <div className="text-center text-surface-400 py-12">Loading settings...</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-600/30 bg-red-900/20 px-4 py-3 text-sm text-red-300 mb-6">
            Failed to load settings: {error}
          </div>
        )}

        {settings && (
          <div className="space-y-6">
            {/* Section 1: Auth Token */}
            <div className="rounded-2xl border border-surface-700 bg-surface-800 p-6">
              <h2 className="mb-4 text-sm font-semibold text-surface-300 uppercase tracking-wider">
                Auth Token
              </h2>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-surface-300">
                  Current Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={settings.authToken}
                    readOnly
                    className="w-full rounded-lg border border-surface-600 bg-surface-900 px-4 py-3 pr-12 text-white outline-none"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors"
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-surface-300">
                  New Token
                </label>
                <input
                  type="text"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="Enter new token..."
                  className="w-full rounded-lg border border-surface-600 bg-surface-900 px-4 py-3 text-white placeholder-surface-500 outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {tokenMessage && (
                <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${
                  tokenMessage.type === 'success'
                    ? 'border border-green-600/30 bg-green-900/20 text-green-300'
                    : 'border border-red-600/30 bg-red-900/20 text-red-300'
                }`}>
                  {tokenMessage.text}
                </div>
              )}

              <button
                onClick={handleSaveToken}
                disabled={!newToken.trim() || tokenSaving}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tokenSaving ? 'Saving...' : 'Save Token'}
              </button>
            </div>

            {/* Section 2: Allowed Projects */}
            <div className="rounded-2xl border border-surface-700 bg-surface-800 p-6">
              <h2 className="mb-4 text-sm font-semibold text-surface-300 uppercase tracking-wider">
                Allowed Projects
              </h2>

              <div className="mb-2">
                <label className="mb-2 block text-sm font-medium text-surface-300">
                  Project Paths
                </label>
                <textarea
                  value={projectsValue}
                  onChange={(e) => setProjectsValue(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-surface-600 bg-surface-900 px-4 py-3 text-white placeholder-surface-500 outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-y font-mono text-sm"
                  placeholder="/home/user/projects/*,/home/user/work"
                />
              </div>

              <p className="mb-4 text-xs text-surface-500">
                Comma-separated absolute paths. Use <code className="text-surface-400">/*</code> suffix to auto-include all subdirectories.
              </p>

              {projectsMessage && (
                <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${
                  projectsMessage.type === 'success'
                    ? 'border border-green-600/30 bg-green-900/20 text-green-300'
                    : 'border border-red-600/30 bg-red-900/20 text-red-300'
                }`}>
                  {projectsMessage.text}
                </div>
              )}

              <button
                onClick={handleSaveProjects}
                disabled={projectsSaving}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {projectsSaving ? 'Saving...' : 'Save Projects'}
              </button>
            </div>

            {/* Section 3: Connection Info */}
            <div className="rounded-2xl border border-surface-700 bg-surface-800 p-6">
              <h2 className="mb-4 text-sm font-semibold text-surface-300 uppercase tracking-wider">
                Connection Info
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-surface-400">Server Port</span>
                  <span className="text-sm font-mono text-surface-200">{settings.port}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-surface-400">WebSocket</span>
                  <span className={`text-sm font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
