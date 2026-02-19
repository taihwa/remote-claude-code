import { useState } from 'react';
import type { AskUserQuestionInput } from '@remote-claude/shared';
import { useSession } from '../hooks/useSession';
import { useChatStore } from '../stores/chatStore';

interface AskUserQuestionCardProps {
  input: AskUserQuestionInput;
  toolUseId: string;
  alreadyAnswered: boolean;
}

export default function AskUserQuestionCard({
  input,
  toolUseId,
  alreadyAnswered,
}: AskUserQuestionCardProps) {
  const { sendMessage } = useSession();
  const isStreaming = useChatStore((s) => s.isStreaming);

  const [submitted, setSubmitted] = useState(alreadyAnswered);
  // Per-question selections: question index → set of selected option labels
  const [selections, setSelections] = useState<Map<number, Set<string>>>(
    () => new Map(),
  );
  // Per-question "Other" text
  const [otherTexts, setOtherTexts] = useState<Map<number, string>>(
    () => new Map(),
  );

  const toggleSelection = (qIdx: number, label: string, multiSelect: boolean) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(qIdx) || []);

      if (label === '__other__') {
        if (current.has('__other__')) {
          current.delete('__other__');
        } else {
          if (!multiSelect) current.clear();
          current.add('__other__');
        }
      } else {
        if (current.has(label)) {
          current.delete(label);
        } else {
          if (!multiSelect) {
            current.clear();
          }
          current.add(label);
        }
      }
      next.set(qIdx, current);
      return next;
    });
  };

  const setOtherText = (qIdx: number, text: string) => {
    setOtherTexts((prev) => {
      const next = new Map(prev);
      next.set(qIdx, text);
      return next;
    });
  };

  const hasSelection = input.questions.every((_, qIdx) => {
    const sel = selections.get(qIdx);
    if (!sel || sel.size === 0) return false;
    if (sel.has('__other__')) {
      return (otherTexts.get(qIdx) || '').trim().length > 0;
    }
    return true;
  });

  const handleSubmit = () => {
    if (!hasSelection || submitted || isStreaming) return;

    const answers: string[] = [];
    input.questions.forEach((q, qIdx) => {
      const sel = selections.get(qIdx);
      if (!sel) return;

      const labels: string[] = [];
      sel.forEach((s) => {
        if (s === '__other__') {
          labels.push(otherTexts.get(qIdx) || '');
        } else {
          labels.push(s);
        }
      });

      if (input.questions.length === 1) {
        answers.push(labels.join(', '));
      } else {
        answers.push(`${q.header || q.question}: ${labels.join(', ')}`);
      }
    });

    const response = answers.join('\n');
    setSubmitted(true);
    sendMessage(response);
  };

  return (
    <div className="my-3 rounded-xl border border-teal-800/50 bg-surface-900/80 overflow-hidden">
      {input.questions.map((q, qIdx) => (
        <div key={qIdx} className={qIdx > 0 ? 'border-t border-surface-700' : ''}>
          {/* Header badge */}
          {q.header && (
            <div className="px-4 pt-3">
              <span className="inline-flex items-center rounded bg-teal-600/20 px-2 py-0.5 text-xs font-medium text-teal-400">
                {q.header}
              </span>
            </div>
          )}

          {/* Question text */}
          <p className="px-4 pt-2 pb-2 text-sm text-surface-100 font-medium">
            {q.question}
          </p>

          {/* Options */}
          <div className="px-4 pb-2 flex flex-col gap-2">
            {q.options.map((opt) => {
              const selected = selections.get(qIdx)?.has(opt.label) ?? false;
              return (
                <button
                  key={opt.label}
                  disabled={submitted}
                  onClick={() => toggleSelection(qIdx, opt.label, q.multiSelect)}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? 'border-teal-500 bg-teal-900/30'
                      : 'border-surface-700 bg-surface-800/50 hover:border-surface-500'
                  } ${submitted ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                >
                  {/* Indicator */}
                  <span className="mt-0.5 flex-shrink-0">
                    {q.multiSelect ? (
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center rounded border text-xs ${
                          selected
                            ? 'border-teal-500 bg-teal-600 text-white'
                            : 'border-surface-500'
                        }`}
                      >
                        {selected && '\u2713'}
                      </span>
                    ) : (
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                          selected
                            ? 'border-teal-500 bg-teal-600'
                            : 'border-surface-500'
                        }`}
                      >
                        {selected && (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </span>
                    )}
                  </span>

                  {/* Label + description */}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-surface-100">
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="text-xs text-surface-400 mt-0.5">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Other option */}
            <button
              disabled={submitted}
              onClick={() => toggleSelection(qIdx, '__other__', q.multiSelect)}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                selections.get(qIdx)?.has('__other__')
                  ? 'border-teal-500 bg-teal-900/30'
                  : 'border-surface-700 bg-surface-800/50 hover:border-surface-500'
              } ${submitted ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
            >
              <span className="mt-0.5 flex-shrink-0">
                {q.multiSelect ? (
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded border text-xs ${
                      selections.get(qIdx)?.has('__other__')
                        ? 'border-teal-500 bg-teal-600 text-white'
                        : 'border-surface-500'
                    }`}
                  >
                    {selections.get(qIdx)?.has('__other__') && '\u2713'}
                  </span>
                ) : (
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                      selections.get(qIdx)?.has('__other__')
                        ? 'border-teal-500 bg-teal-600'
                        : 'border-surface-500'
                    }`}
                  >
                    {selections.get(qIdx)?.has('__other__') && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </span>
                )}
              </span>
              <div className="text-sm font-medium text-surface-100">Other</div>
            </button>

            {/* Other text input */}
            {selections.get(qIdx)?.has('__other__') && (
              <input
                type="text"
                disabled={submitted}
                placeholder="Type your answer..."
                value={otherTexts.get(qIdx) || ''}
                onChange={(e) => setOtherText(qIdx, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                }}
                className="ml-7 rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:border-teal-500 focus:outline-none"
              />
            )}
          </div>
        </div>
      ))}

      {/* Submit / status bar */}
      <div className="border-t border-surface-700 px-4 py-3 flex items-center justify-end gap-3">
        {submitted ? (
          <span className="text-xs text-teal-400 font-medium">
            Response sent
          </span>
        ) : (
          <button
            disabled={!hasSelection || isStreaming}
            onClick={handleSubmit}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              hasSelection && !isStreaming
                ? 'bg-teal-600 text-white hover:bg-teal-500'
                : 'bg-surface-700 text-surface-400 cursor-not-allowed'
            }`}
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
}
