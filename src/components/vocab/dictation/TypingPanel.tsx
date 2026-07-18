import { useRef, useState } from 'react';
import GameIcon from '@/components/common/GameIcon';

interface Props {
  /** 期望文本的字符数（用于提示） */
  expectedLength: number;
  onSubmit: (input: string) => { correct: boolean; expected: string };
  disabled?: boolean;
}

/**
 * 键入模式面板：用户输入日文文本并提交。
 * 支持 IME 输入，按 Enter 提交。
 */
export default function TypingPanel({ expectedLength, onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');
  const [composing, setComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (composing || disabled) return;
    if (!value.trim()) return;
    onSubmit(value);
    setValue('');
    // 保持焦点便于连续输入
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !composing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-apple-text-secondary">
        <GameIcon name="keyboard" className="w-3.5 h-3.5" />
        <span>请用键盘输入听到的单词（共 {expectedLength} 字）</span>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          lang="ja"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => {
            setComposing(false);
            setValue((e.target as HTMLInputElement).value);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoFocus
          placeholder="输入日文..."
          className="flex-1 px-4 py-3 rounded-xl bg-white/70 dark:bg-white/[0.06]
            border border-black/10 dark:border-white/10
            text-base text-apple-text dark:text-white
            placeholder:text-apple-text-secondary/50
            focus:outline-none focus:ring-2 focus:ring-apple-blue/40
            transition-shadow"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim() || composing}
          className="px-5 py-3 rounded-xl bg-apple-blue text-white text-sm font-medium
            shadow-sm hover:opacity-90 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          提交
        </button>
      </div>

      <p className="text-[11px] text-apple-text-secondary">
        提示：使用手写输入法获得最佳体验，回车键快速提交
      </p>
    </div>
  );
}
