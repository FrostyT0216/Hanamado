import { useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: string;
}

export default function Modal({ isOpen, onClose, title, children, width = 'max-w-md' }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 animate-fade-in"
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className={`relative ${width} w-full mx-4 glass-card animate-scale-in max-h-[92vh] flex flex-col`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <GameIcon name="cross" className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}
        {/* Content */}
        <CustomScrollbar className="flex-1 min-h-0 overflow-hidden" viewportClassName="p-5">
          {children}
        </CustomScrollbar>
      </div>
    </div>,
    document.body
  );
}