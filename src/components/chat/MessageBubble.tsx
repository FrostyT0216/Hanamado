import { useState, useMemo } from 'react';
import type { GrammarError, Message, Role, Token } from '@/types';
import TokenBlock from './TokenBlock';
import Loading from '@/components/common/Loading';
import GameIcon from '@/components/common/GameIcon';
import RoleAvatar from '@/components/common/RoleAvatar';

interface MessageBubbleProps {
  message: Message;
  /** 当前会话的角色（用于在 AI 消息左侧显示头像） */
  role?: Role;
  onTokenClick: (token: Token) => void;
  onRetry?: () => void;
  onGrammarCorrect?: (sentence: string) => void;
}

/**
 * Split the user's message text into segments, marking which ones are errors.
 * Returns an array of { text, isError, error? } for rendering.
 */
function splitContentWithErrors(
  content: string,
  errors: GrammarError[]
): Array<{ text: string; isError: boolean; error?: GrammarError }> {
  if (!errors || errors.length === 0) {
    return [{ text: content, isError: false }];
  }

  // Sort errors by start position
  const sorted = [...errors].sort((a, b) => a.start - b.start);

  const segments: Array<{ text: string; isError: boolean; error?: GrammarError }> = [];
  let cursor = 0;

  for (const err of sorted) {
    // Clamp positions to valid range
    const start = Math.max(0, Math.min(err.start, content.length));
    const end = Math.max(start, Math.min(err.end, content.length));

    // Normal text before this error
    if (cursor < start) {
      segments.push({ text: content.slice(cursor, start), isError: false });
    }

    // Error text
    if (end > start) {
      segments.push({ text: content.slice(start, end), isError: true, error: err });
    }

    cursor = end;
  }

  // Remaining text after last error
  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), isError: false });
  }

  return segments;
}

export default function MessageBubble({ message, role, onTokenClick, onRetry, onGrammarCorrect }: MessageBubbleProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [showErrorDetail, setShowErrorDetail] = useState(false);

  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const isSending = message.status === 'sending';
  const hasTranslation = !isError && !isSending && message.translation;
  const hasGrammarErrors = isUser && message.grammarErrors && message.grammarErrors.length > 0;

  // Split user content into error/normal segments
  const contentSegments = useMemo(() => {
    if (!hasGrammarErrors) return null;
    return splitContentWithErrors(message.content, message.grammarErrors!);
  }, [hasGrammarErrors, message.content, message.grammarErrors]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 gap-2`}>
      {/* AI 头像（仅 AI 消息显示，位于气泡左侧） */}
      {!isUser && role && (
        <RoleAvatar role={role} size={32} className="mt-1" />
      )}
      <div className={`max-w-[80%]`}>
        {/* User message */}
        {isUser && (
          <div className="relative">
            {/* Main bubble */}
            <div className="bubble-user px-4 py-2.5 rounded-bubble rounded-tr-[4px] bubble-text">
              {/* Render content with error highlights */}
              {hasGrammarErrors && contentSegments ? (
                <span>
                  {contentSegments.map((seg, i) =>
                    seg.isError ? (
                      <span
                        key={i}
                        className="relative cursor-help"
                        title={seg.error?.message}
                      >
                        <span className="border-b-2 border-dotted border-red-300/80 pb-0.5">
                          {seg.text}
                        </span>
                      </span>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  )}
                </span>
              ) : (
                message.content
              )}
            </div>

            {/* Grammar error indicator bar at bottom */}
            {hasGrammarErrors && (
              <div className="mt-1.5 space-y-1.5">
                {/* Error summary + action button */}
                <div className="flex items-center gap-2">
                  {/* Error count badge */}
                  <button
                    onClick={() => setShowErrorDetail(!showErrorDetail)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full
                      bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                      bubble-meta text-red-600 dark:text-red-400
                      hover:bg-red-100 dark:hover:bg-red-900/30
                      transition-colors duration-200"
                  >
                    <GameIcon name="info" className="w-[11px] h-[11px] flex-shrink-0" />
                    <span>{message.grammarErrors!.length} 处语法问题</span>
                  </button>

                  {/* AI correction button */}
                  <button
                    onClick={() => onGrammarCorrect?.(message.content)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full
                      bg-apple-blue/10 hover:bg-apple-blue/20
                      bubble-meta font-medium text-apple-blue
                      border border-apple-blue/20 hover:border-apple-blue/30
                      transition-all duration-200 active:scale-[0.97]"
                  >
                    <GameIcon name="sparkles" className="w-[11px] h-[11px] flex-shrink-0" />
                    <span>AI语法纠错</span>
                  </button>
                </div>

                {/* Expandable error details */}
                {showErrorDetail && (
                  <div className="animate-fade-in space-y-1">
                    {message.grammarErrors!.map((err, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 rounded-lg
                          bg-red-50/80 dark:bg-red-900/10
                          border border-red-100 dark:border-red-900/20
                          bubble-meta leading-relaxed"
                      >
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          「{message.content.slice(err.start, err.end)}」
                        </span>
                        <span className="text-red-700/80 dark:text-red-300/80 ml-1.5">
                          {err.message}
                        </span>
                        {err.suggestion && (
                          <span className="block mt-0.5 text-green-600 dark:text-green-400">
                            建议: {err.suggestion}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI message */}
        {!isUser && (
          <div className="relative group/bubble">
            {/* Bubble container */}
            <div className="bubble-ai glass-card px-4 py-3 rounded-tl-[4px] transition-shadow duration-300
              group-hover/bubble:shadow-md">
              {/* Error state */}
              {isError && (
                <div className="flex items-center gap-2 bubble-text text-red-500">
                  <span>{message.content || 'AI 响应格式异常，请重试'}</span>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="text-xs underline hover:no-underline flex-shrink-0"
                    >
                      重试
                    </button>
                  )}
                </div>
              )}

              {/* Loading state */}
              {isSending && <Loading variant="dots" />}

              {/* Tokenized content */}
              {!isError && !isSending && message.tokens && message.tokens.length > 0 && (
                <div className="flex flex-wrap items-center leading-relaxed">
                  {message.tokens.map((token, i) => (
                    <TokenBlock
                      key={`${token.text}-${i}`}
                      token={token}
                      onClick={onTokenClick}
                    />
                  ))}
                </div>
              )}

              {/* Fallback: plain text if no tokens */}
              {!isError && !isSending && (!message.tokens || message.tokens.length === 0) && message.content && (
                <p className="bubble-text">{message.content}</p>
              )}

              {/* Translation panel */}
              {hasTranslation && showTranslation && (
                <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-white/5 animate-fade-in">
                  <p className="bubble-translation text-apple-text-secondary">
                    {message.translation}
                  </p>
                </div>
              )}
            </div>

            {/* Translation toggle button */}
            {hasTranslation && (
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={`absolute top-2 -right-1 translate-x-full
                  p-1.5 rounded-full transition-all duration-200
                  ${showTranslation
                    ? 'bg-apple-blue/10 text-apple-blue shadow-sm'
                    : 'text-apple-text-secondary/40 hover:text-apple-text-secondary hover:bg-black/3 dark:hover:bg-white/5'
                  }`}
                title={showTranslation ? '隐藏翻译' : '显示翻译'}
              >
                <GameIcon name="translate" className="w-[14px] h-[14px]" />
              </button>
            )}

            {/* Hover highlight bar at bottom */}
            <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full
              bg-gradient-to-r from-transparent via-apple-blue/25 to-transparent
              opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-300 ease-out" />
          </div>
        )}
      </div>
    </div>
  );
}