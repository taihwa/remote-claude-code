import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, AskUserQuestionInput } from '@remote-claude/shared';
import { ToolCall, ToolResult } from './ToolCallDisplay';
import AskUserQuestionCard from './AskUserQuestionCard';
import { useChatStore } from '../stores/chatStore';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-surface-800 text-surface-100 border border-surface-700'
        } ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`}
      >
        {message.content.map((block, index) => {
          switch (block.type) {
            case 'text':
              if (!block.text.trim()) return null;
              return isUser ? (
                <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed">
                  {block.text}
                </p>
              ) : (
                <div key={index} className="markdown-content text-sm leading-relaxed">
                  <Markdown remarkPlugins={[remarkGfm]}>{block.text}</Markdown>
                </div>
              );

            case 'tool_use': {
              if (
                block.name === 'AskUserQuestion' &&
                block.input &&
                Array.isArray((block.input as Record<string, unknown>).questions)
              ) {
                const messages = useChatStore.getState().messages;
                const msgIdx = messages.findIndex((m) => m.id === message.id);
                const alreadyAnswered = messages
                  .slice(msgIdx + 1)
                  .some((m) => m.role === 'user');
                return (
                  <AskUserQuestionCard
                    key={index}
                    input={block.input as unknown as AskUserQuestionInput}
                    toolUseId={block.id}
                    alreadyAnswered={alreadyAnswered}
                  />
                );
              }
              return <ToolCall key={index} block={block} />;
            }

            case 'tool_result':
              return <ToolResult key={index} block={block} />;

            default:
              return null;
          }
        })}

        {/* Model badge for assistant messages */}
        {!isUser && message.model && (
          <div className="mt-2 text-xs text-surface-500">{message.model}</div>
        )}
      </div>
    </div>
  );
}
