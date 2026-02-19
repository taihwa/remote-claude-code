import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';

interface InputBarProps {
  onSend: (message: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  isConnected: boolean;
  disabled?: boolean;
}

export default function InputBar({
  onSend,
  onCancel,
  isStreaming,
  isConnected,
  disabled = false,
}: InputBarProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !isConnected || disabled) return;
    onSend(trimmed);
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, isConnected, disabled, onSend]);

  const handleFinalTranscript = useCallback(
    (text: string) => {
      if (!isConnected || disabled || isStreaming) return;

      if (input.trim()) {
        // Existing text — append and let user review
        setInput((prev) => (prev ? `${prev} ${text}` : text));
      } else {
        // Empty textarea — send immediately
        onSend(text);
      }
    },
    [input, isConnected, disabled, isStreaming, onSend],
  );

  const {
    voiceState,
    isSupported: voiceSupported,
    errorMessage: voiceError,
    interimTranscript,
    toggleListening,
  } = useVoiceInput({ onFinalTranscript: handleFinalTranscript });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 5 * 24; // ~5 lines
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, []);

  const canSend = input.trim().length > 0 && isConnected && !isStreaming && !disabled;
  const showMicButton = voiceSupported && !isStreaming;

  return (
    <div className="border-t border-surface-700 bg-surface-800/80 backdrop-blur-sm px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="relative flex-1">
          {/* Interim transcript overlay */}
          {voiceState === 'listening' && interimTranscript && (
            <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg bg-surface-700/90 px-3 py-2 text-sm italic text-surface-300">
              {interimTranscript}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              !isConnected
                ? 'Disconnected...'
                : disabled
                  ? 'Select a project to start...'
                  : voiceState === 'listening'
                    ? 'Listening...'
                    : 'Send a message...'
            }
            disabled={!isConnected || disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-surface-600 bg-surface-900 px-4 py-3 pr-12 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ maxHeight: `${5 * 24}px` }}
          />
        </div>

        {/* Microphone button */}
        {showMicButton && (
          <button
            onClick={toggleListening}
            disabled={!isConnected || disabled}
            className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              voiceState === 'listening'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-surface-600 text-surface-300 hover:bg-surface-500'
            }`}
            title={voiceState === 'listening' ? 'Stop listening' : 'Voice input'}
          >
            {/* Pulse ring when listening */}
            {voiceState === 'listening' && (
              <span className="absolute inset-0 animate-ping rounded-xl bg-red-600 opacity-30" />
            )}
            <svg
              className="relative h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
              />
            </svg>
          </button>
        )}

        {isStreaming ? (
          <button
            onClick={onCancel}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-600 text-white transition-colors hover:bg-red-700"
            title="Cancel"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Send"
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
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Connection status */}
      {!isConnected && (
        <div className="mx-auto mt-2 max-w-3xl text-center text-xs text-red-400">
          Disconnected - attempting to reconnect...
        </div>
      )}

      {/* Voice error */}
      {voiceError && (
        <div className="mx-auto mt-2 max-w-3xl text-center text-xs text-amber-400">
          {voiceError}
        </div>
      )}
    </div>
  );
}
