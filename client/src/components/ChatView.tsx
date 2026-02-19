import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSession } from '../hooks/useSession';
import { useVoiceOutput } from '../hooks/useVoiceOutput';
import MessageList from './MessageList';
import InputBar from './InputBar';
import ProjectSelector from './ProjectSelector';
import PermissionDialog from './PermissionDialog';
import type { ChatMessage } from '@remote-claude/shared';

/** Extract readable text from an assistant message, skipping tool blocks. */
function extractAssistantText(message: ChatMessage): string {
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n')
    .trim();
}

export default function ChatView() {
  const {
    sendMessage,
    cancel,
    listProjects,
    setProjectDir,
    sendPermissionResponse,
    sessionId,
    projectDir,
    isStreaming,
    isConnected,
  } = useSession();

  const messages = useChatStore((s) => s.messages);
  const costUsd = useChatStore((s) => s.costUsd);
  const durationMs = useChatStore((s) => s.durationMs);
  const pendingPermission = useChatStore((s) => s.pendingPermission);
  const clearPendingPermission = useChatStore((s) => s.clearPendingPermission);

  const { ttsEnabled, toggleTts, speak, isSpeaking, stop: stopSpeaking } = useVoiceOutput();

  // Track previous streaming state to detect completion
  const prevStreamingRef = useRef(isStreaming);

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;

    // Trigger TTS when streaming just finished
    if (wasStreaming && !isStreaming && ttsEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const text = extractAssistantText(lastMessage);
        if (text) {
          speak(text);
        }
      }
    }
  }, [isStreaming, ttsEnabled, messages, speak]);

  const handlePermissionRespond = (id: string, granted: boolean, alwaysAllow?: boolean) => {
    sendPermissionResponse(id, granted, alwaysAllow);
    clearPendingPermission();
  };

  const formatCost = (cost: number) => {
    if (cost === 0) return '';
    return `$${cost.toFixed(4)}`;
  };

  const formatDuration = (ms: number) => {
    if (ms === 0) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-surface-900">
      {/* Permission Dialog */}
      {pendingPermission && (
        <PermissionDialog
          id={pendingPermission.id}
          toolName={pendingPermission.toolName}
          toolInput={pendingPermission.toolInput}
          onRespond={handlePermissionRespond}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-surface-700 bg-surface-800/80 backdrop-blur-sm px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Project selector */}
          <ProjectSelector
            onSelect={setProjectDir}
            selectedDir={projectDir}
            listProjects={listProjects}
          />

          {/* Connection indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-surface-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Session info */}
          {sessionId && (
            <span className="hidden text-xs text-surface-500 sm:inline">
              {sessionId.slice(0, 8)}...
            </span>
          )}

          {/* Cost display */}
          {costUsd > 0 && (
            <div className="flex items-center gap-2 text-xs text-surface-400">
              <span>{formatCost(costUsd)}</span>
              {durationMs > 0 && (
                <>
                  <span className="text-surface-600">|</span>
                  <span>{formatDuration(durationMs)}</span>
                </>
              )}
            </div>
          )}

          {/* TTS toggle */}
          <button
            onClick={isSpeaking ? stopSpeaking : toggleTts}
            className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${
              ttsEnabled ? 'text-primary-400 hover:text-primary-300' : 'text-surface-500 hover:text-surface-400'
            }`}
            title={isSpeaking ? 'Stop speaking' : ttsEnabled ? 'Disable TTS' : 'Enable TTS'}
          >
            {isSpeaking ? (
              /* Speaker with sound waves (speaking) */
              <svg className="h-4 w-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.8L10.7 5.2a.6.6 0 011.1.4v12.8a.6.6 0 01-1.1.4L6.5 15.2H4a1 1 0 01-1-1v-4.4a1 1 0 011-1h2.5z" />
              </svg>
            ) : ttsEnabled ? (
              /* Speaker on */
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.8L10.7 5.2a.6.6 0 011.1.4v12.8a.6.6 0 01-1.1.4L6.5 15.2H4a1 1 0 01-1-1v-4.4a1 1 0 011-1h2.5z" />
              </svg>
            ) : (
              /* Speaker off */
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 8.8L10.7 5.2a.6.6 0 011.1.4v12.8a.6.6 0 01-1.1.4L6.5 15.2H4a1 1 0 01-1-1v-4.4a1 1 0 011-1h2.5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>

          {/* Streaming indicator */}
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-primary-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary-400" />
              Streaming
            </span>
          )}
        </div>
      </header>

      {/* Messages */}
      <MessageList />

      {/* Input */}
      <InputBar
        onSend={sendMessage}
        onCancel={cancel}
        isStreaming={isStreaming}
        isConnected={isConnected}
        disabled={!projectDir}
      />
    </div>
  );
}
