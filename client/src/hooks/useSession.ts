import { useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useWebSocket } from './useWebSocket';

export function useSession() {
  const { send, isConnected } = useWebSocket();

  const sessionId = useChatStore((s) => s.sessionId);
  const projectDir = useChatStore((s) => s.projectDir);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const addMessage = useChatStore((s) => s.addMessage);
  const clearSession = useChatStore((s) => s.clearSession);
  const setProjectDir = useCallback(
    (dir: string) => {
      const state = useChatStore.getState();
      state.setSession(state.sessionId ?? '', dir);
    },
    [],
  );

  const createSession = useCallback(
    (prompt: string, dir: string) => {
      // Add user message to chat
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        timestamp: Date.now(),
      });
      setStreaming(true);
      send({
        type: 'create_session',
        prompt,
        projectDir: dir,
      });
    },
    [send, addMessage, setStreaming],
  );

  const resumeSession = useCallback(
    (prompt: string, sid: string) => {
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        timestamp: Date.now(),
      });
      setStreaming(true);
      send({
        type: 'resume_session',
        prompt,
        sessionId: sid,
        projectDir: projectDir || undefined,
      });
    },
    [send, addMessage, setStreaming, projectDir],
  );

  const continueSession = useCallback(
    (prompt: string) => {
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        timestamp: Date.now(),
      });
      setStreaming(true);
      send({
        type: 'continue_session',
        prompt,
      });
    },
    [send, addMessage, setStreaming],
  );

  const cancel = useCallback(() => {
    send({ type: 'cancel' });
    setStreaming(false);
  }, [send, setStreaming]);

  const listProjects = useCallback(() => {
    send({ type: 'list_projects' });
  }, [send]);

  const sendPermissionResponse = useCallback(
    (id: string, granted: boolean, alwaysAllow?: boolean) => {
      send({ type: 'permission_response', id, granted, alwaysAllow });
    },
    [send],
  );

  const sendMessage = useCallback(
    (prompt: string) => {
      if (!prompt.trim()) return;

      if (sessionId) {
        // We have an active session - resume it with the specific session ID
        resumeSession(prompt, sessionId);
      } else if (projectDir) {
        // No session yet but project is selected - create new
        createSession(prompt, projectDir);
      }
    },
    [sessionId, projectDir, createSession, resumeSession],
  );

  const newSession = useCallback(() => {
    clearSession();
  }, [clearSession]);

  return {
    sendMessage,
    createSession,
    resumeSession,
    continueSession,
    cancel,
    listProjects,
    newSession,
    setProjectDir,
    sendPermissionResponse,
    sessionId,
    projectDir,
    isStreaming,
    isConnected,
  };
}
