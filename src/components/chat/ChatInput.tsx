import { useRef, useCallback, type KeyboardEvent } from 'react';
import GameIcon from '@/components/common/GameIcon';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const text = textareaRef.current?.value.trim();
    if (!text || disabled) return;
    onSend(text);
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.style.height = 'auto';
    }
  }, [onSend, disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const hasText = (textareaRef.current?.value?.trim()?.length ?? 0) > 0;

  return (
    <div className="glass rounded-bubble flex items-end gap-2 px-4 py-2.5 shadow-sm">
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder="输入日语消息..."
        disabled={disabled}
        onInput={adjustHeight}
        onKeyDown={handleKeyDown}
        className="flex-1 resize-none bg-transparent outline-none bubble-text
          placeholder:text-apple-text-secondary/50
          disabled:opacity-40 disabled:cursor-not-allowed
          min-h-[24px] max-h-[200px] py-0.5"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !hasText}
        className="p-1.5 rounded-lg text-apple-blue hover:bg-apple-blue/10
          disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
      >
        <GameIcon name="send" className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}