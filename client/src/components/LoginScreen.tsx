import { useState, type FormEvent } from 'react';
import { useChatStore } from '../stores/chatStore';

export default function LoginScreen() {
  const [tokenInput, setTokenInput] = useState('');
  const setToken = useChatStore((s) => s.setToken);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (trimmed) {
      setToken(trimmed);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-900 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-surface-700 bg-surface-800 p-8 shadow-2xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-3 text-3xl font-bold tracking-tight text-white">
              Remote Claude Code
            </div>
            <p className="text-sm text-surface-400">
              Enter your access token to connect
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="token"
                className="mb-2 block text-sm font-medium text-surface-300"
              >
                Access Token
              </label>
              <input
                id="token"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter your token..."
                autoFocus
                className="w-full rounded-lg border border-surface-600 bg-surface-900 px-4 py-3 text-white placeholder-surface-500 outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <button
              type="submit"
              disabled={!tokenInput.trim()}
              className="w-full rounded-lg bg-primary-600 px-4 py-3 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Connect
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-surface-500">
            Token is stored locally in your browser
          </p>
        </div>
      </div>
    </div>
  );
}
