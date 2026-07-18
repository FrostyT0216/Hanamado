import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GameIcon from '@/components/common/GameIcon';

interface GrammarMenuProps {
  selectedText: string;
  position: { x: number; y: number };
  onQuery: (text: string) => void;
  onCopy: (text: string) => void;
  onClose: () => void;
}

export default function GrammarMenu({ selectedText, position, onQuery, onCopy, onClose }: GrammarMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close on the mouseup that triggered this
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  useEffect(() => {
    if (!menuRef.current) return;

    const menuWidth = menuRef.current.offsetWidth;
    const menuHeight = menuRef.current.offsetHeight;

    // Position above the selection by default, with a small gap
    let top = position.y - menuHeight - 10;
    let left = position.x - menuWidth / 2;

    // If too close to top, show below
    if (top < 16) {
      top = position.y + 28;
    }

    // Keep within horizontal bounds
    const padding = 12;
    if (left < padding) {
      left = padding;
    } else if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    setAdjustedPos({ x: left, y: top });
  }, [position]);

  // Truncate displayed text if too long
  const displayText = selectedText.length > 20
    ? selectedText.slice(0, 20) + '...'
    : selectedText;

  const handleCopy = () => {
    onCopy(selectedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 animate-scale-in"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        opacity: adjustedPos.x === 0 && adjustedPos.y === 0 ? 0 : 1,
      }}
    >
      <div
        className="glass-card p-1 flex items-center gap-0.5 text-sm font-medium
          shadow-lg shadow-black/5 dark:shadow-black/20"
      >
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
            text-apple-text-secondary hover:text-apple-blue
            hover:bg-apple-blue/[0.06] active:scale-[0.97]
            transition-all duration-200 whitespace-nowrap"
          title="复制选中文本"
        >
          {copied ? (
            <GameIcon name="tick" className="w-[14px] h-[14px] flex-shrink-0 text-green-500" />
          ) : (
            <GameIcon name="copy" className="w-[14px] h-[14px] flex-shrink-0" />
          )}
          <span className={copied ? 'text-green-600 dark:text-green-400' : ''}>
            {copied ? '已复制' : '复制'}
          </span>
        </button>

        <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5" />

        {/* Grammar query button */}
        <button
          onClick={() => onQuery(selectedText)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
            text-apple-blue hover:bg-apple-blue/[0.06] active:scale-[0.97]
            transition-all duration-200 group/menu whitespace-nowrap"
        >
          <GameIcon name="book" className="w-[14px] h-[14px] flex-shrink-0" />
          <span className="flex items-center gap-1">
            <span className="text-apple-text-secondary/60 font-normal text-xs max-w-[100px] truncate">
              "{displayText}"
            </span>
            <span className="flex items-center gap-0.5">
              询问语法
              <GameIcon name="arrowRight" className="w-[13px] h-[13px] transition-transform duration-200 group-hover/menu:translate-x-0.5" />
            </span>
          </span>
        </button>
      </div>
    </div>,
    document.body
  );
}