import { useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'right' | 'left';
}

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = position === 'top' ? rect.top : rect.bottom;
      if (position === 'right') {
        x = rect.right;
        y = rect.top + rect.height / 2;
      } else if (position === 'left') {
        x = rect.left;
        y = rect.top + rect.height / 2;
      }
      setCoords({ x, y });
    }
    setIsVisible(true);
  };

  const hide = () => setIsVisible(false);

  const isVertical = position === 'top' || position === 'bottom';

  return (
    <span
      ref={containerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      className="relative inline-flex"
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            className="fixed z-[100] pointer-events-none"
            style={{
              left: coords.x,
              top: isVertical ? (position === 'top' ? coords.y - 8 : coords.y + 8) : coords.y,
              transform: isVertical
                ? `translate(-50%, ${position === 'top' ? '-100%' : '0'})`
                : `translate(${position === 'right' ? '8px' : 'calc(-100% - 8px)'}, -50%)`,
            }}
          >
            <div
              className="glass-card px-2.5 py-1.5 text-xs text-apple-text dark:text-gray-200 whitespace-nowrap shadow-lg animate-fade-in
                rounded-lg border border-black/5 dark:border-white/10"
            >
              {content}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
