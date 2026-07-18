import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  items: Array<{
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    danger?: boolean;
  }>;
}

export default function ContextMenu({ x, y, isOpen, onClose, items }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Adjust position to stay within viewport
  let adjustedX = x;
  let adjustedY = y;
  const menuWidth = 160;
  const menuHeight = items.length * 40 + 8;

  if (x + menuWidth > window.innerWidth) adjustedX = window.innerWidth - menuWidth - 8;
  if (y + menuHeight > window.innerHeight) adjustedY = window.innerHeight - menuHeight - 8;
  if (adjustedX < 0) adjustedX = 8;
  if (adjustedY < 0) adjustedY = 8;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 py-1 min-w-[140px] glass-card animate-scale-in"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
            ${item.danger
              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
              : 'text-apple-text dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
        >
          {item.icon && <span className="w-4 h-4">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}