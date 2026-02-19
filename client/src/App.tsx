import { useState, useCallback, useEffect } from 'react';
import { useChatStore } from './stores/chatStore';
import LoginScreen from './components/LoginScreen';
import ChatView from './components/ChatView';
import SettingsPage from './components/SettingsPage';
import SessionSidebar from './components/SessionSidebar';

export default function App() {
  const token = useChatStore((s) => s.token);
  const sessionId = useChatStore((s) => s.sessionId);
  const clearSession = useChatStore((s) => s.clearSession);
  const saveCurrentSession = useChatStore((s) => s.saveCurrentSession);
  const switchSession = useChatStore((s) => s.switchSession);
  const clearToken = useChatStore((s) => s.clearToken);
  const reset = useChatStore((s) => s.reset);
  const currentView = useChatStore((s) => s.currentView);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Save session on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCurrentSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveCurrentSession]);

  const handleNewSession = useCallback(
    (projectDir: string) => {
      saveCurrentSession();
      clearSession();
      useChatStore.setState({ projectDir });
      setSidebarOpen(false);
    },
    [saveCurrentSession, clearSession],
  );

  const handleResumeSession = useCallback(
    (targetSessionId: string) => {
      switchSession(targetSessionId);
      setSidebarOpen(false);
    },
    [switchSession],
  );

  const handleLogout = useCallback(() => {
    reset();
    clearToken();
  }, [reset, clearToken]);

  // Not authenticated
  if (!token) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SessionSidebar
          currentSessionId={sessionId}
          onNewSession={handleNewSession}
          onResumeSession={handleResumeSession}
          onLogout={handleLogout}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile menu button */}
        <div className="flex items-center lg:hidden border-b border-surface-700 bg-surface-800 px-3 py-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="ml-3 text-sm font-medium text-surface-200">
            Remote Claude Code
          </span>
        </div>

        {/* Main view */}
        {currentView === 'settings' ? <SettingsPage /> : <ChatView />}
      </div>
    </div>
  );
}
