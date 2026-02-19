import { create } from 'zustand';
import type {
  ChatMessage,
  CliContentBlock,
  ProjectInfo,
} from '@remote-claude/shared';

interface PersistedSession {
  messages: ChatMessage[];
  costUsd: number;
  durationMs: number;
  projectDir: string;
}

interface PendingPermission {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

interface ChatStore {
  // State
  messages: ChatMessage[];
  sessionId: string | null;
  projectDir: string | null;
  isStreaming: boolean;
  isConnected: boolean;
  projects: ProjectInfo[];
  costUsd: number;
  durationMs: number;
  token: string | null;
  pendingPermission: PendingPermission | null;
  currentView: 'chat' | 'settings';

  // Message actions
  addMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (text: string) => void;
  appendContentBlocks: (blocks: CliContentBlock[]) => void;

  // Connection / streaming
  setStreaming: (streaming: boolean) => void;
  setConnected: (connected: boolean) => void;

  // Session
  setSession: (sessionId: string, projectDir?: string) => void;
  clearSession: () => void;
  saveCurrentSession: () => void;
  loadSession: (sessionId: string) => void;
  switchSession: (sessionId: string) => void;

  // Projects
  setProjects: (projects: ProjectInfo[]) => void;

  // Cost tracking
  setCost: (costUsd: number, durationMs: number) => void;

  // Permission
  setPendingPermission: (perm: PendingPermission | null) => void;
  clearPendingPermission: () => void;

  // View
  setView: (view: 'chat' | 'settings') => void;

  // Auth
  setToken: (token: string) => void;
  clearToken: () => void;

  // Reset
  reset: () => void;
}

const getInitialToken = (): string | null => {
  try {
    return localStorage.getItem('rcc-token');
  } catch {
    return null;
  }
};

const initialState = {
  messages: [] as ChatMessage[],
  sessionId: null as string | null,
  projectDir: null as string | null,
  isStreaming: false,
  isConnected: false,
  projects: [] as ProjectInfo[],
  costUsd: 0,
  durationMs: 0,
  token: getInitialToken(),
  pendingPermission: null as PendingPermission | null,
  currentView: 'chat' as 'chat' | 'settings',
};

export const useChatStore = create<ChatStore>()((set, get) => ({
  ...initialState,

  addMessage: (message) => {
    const { messages, isStreaming } = get();
    const lastMsg = messages[messages.length - 1];

    // If we're streaming and the last message is an assistant message,
    // and the new message is also an assistant message, merge content blocks
    if (
      message.role === 'assistant' &&
      lastMsg &&
      lastMsg.role === 'assistant' &&
      isStreaming
    ) {
      const updatedMessages = [...messages];
      const merged = { ...lastMsg };
      merged.content = [...merged.content, ...message.content];
      if (message.model) {
        merged.model = message.model;
      }
      updatedMessages[updatedMessages.length - 1] = merged;
      set({ messages: updatedMessages });
    } else {
      set({ messages: [...messages, message] });
    }
  },

  updateLastAssistantMessage: (text) => {
    const { messages } = get();
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    const updatedMessages = [...messages];
    const updated = { ...lastMsg };
    const lastBlock = updated.content[updated.content.length - 1];

    if (lastBlock && lastBlock.type === 'text') {
      // Append to existing text block
      updated.content = [
        ...updated.content.slice(0, -1),
        { ...lastBlock, text: lastBlock.text + text },
      ];
    } else {
      // Add new text block
      updated.content = [...updated.content, { type: 'text' as const, text }];
    }

    updatedMessages[updatedMessages.length - 1] = updated;
    set({ messages: updatedMessages });
  },

  appendContentBlocks: (blocks) => {
    const { messages } = get();
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    const updatedMessages = [...messages];
    const updated = { ...lastMsg };
    updated.content = [...updated.content, ...blocks];
    updatedMessages[updatedMessages.length - 1] = updated;
    set({ messages: updatedMessages });
  },

  setStreaming: (isStreaming) => set({ isStreaming }),
  setConnected: (isConnected) => set({ isConnected }),

  setSession: (sessionId, projectDir) => {
    const update: Partial<ChatStore> = { sessionId };
    if (projectDir !== undefined) {
      update.projectDir = projectDir;
    }
    set(update);
  },

  clearSession: () =>
    set({
      sessionId: null,
      messages: [],
      costUsd: 0,
      durationMs: 0,
      isStreaming: false,
    }),

  saveCurrentSession: () => {
    const { sessionId, messages, costUsd, durationMs, projectDir } = get();
    if (!sessionId || messages.length === 0) return;
    try {
      const data: PersistedSession = {
        messages,
        costUsd,
        durationMs,
        projectDir: projectDir || '',
      };
      localStorage.setItem(`rcc-messages-${sessionId}`, JSON.stringify(data));
    } catch {
      // ignore storage errors
    }
  },

  loadSession: (sessionId) => {
    try {
      const raw = localStorage.getItem(`rcc-messages-${sessionId}`);
      if (raw) {
        const data = JSON.parse(raw) as PersistedSession;
        set({
          sessionId,
          messages: data.messages,
          costUsd: data.costUsd,
          durationMs: data.durationMs,
          projectDir: data.projectDir || null,
          isStreaming: false,
        });
        return;
      }
    } catch {
      // ignore parse errors
    }
    // No persisted data — just set the sessionId with empty state
    set({
      sessionId,
      messages: [],
      costUsd: 0,
      durationMs: 0,
      isStreaming: false,
    });
  },

  switchSession: (sessionId) => {
    const { sessionId: currentId, saveCurrentSession, loadSession } = get();
    if (currentId === sessionId) return;
    saveCurrentSession();
    loadSession(sessionId);
  },

  setProjects: (projects) => set({ projects }),

  setCost: (costUsd, durationMs) => set({ costUsd, durationMs }),

  setPendingPermission: (pendingPermission) => set({ pendingPermission }),
  clearPendingPermission: () => set({ pendingPermission: null }),

  setView: (currentView) => set({ currentView }),

  setToken: (token) => {
    try {
      localStorage.setItem('rcc-token', token);
    } catch {
      // ignore storage errors
    }
    set({ token });
  },

  clearToken: () => {
    try {
      localStorage.removeItem('rcc-token');
    } catch {
      // ignore storage errors
    }
    set({ token: null });
  },

  reset: () => set({ ...initialState, token: get().token }),
}));
