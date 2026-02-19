import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import MessageBubble from './MessageBubble';

export default function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-3 text-4xl text-surface-600">&#8669;</div>
          <h2 className="mb-2 text-lg font-medium text-surface-400">
            Start a conversation
          </h2>
          <p className="text-sm text-surface-500">
            Select a project and send a message to begin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-3xl">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-surface-700 bg-surface-800 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary-400" />
                <span
                  className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary-400"
                  style={{ animationDelay: '0.2s' }}
                />
                <span
                  className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary-400"
                  style={{ animationDelay: '0.4s' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
