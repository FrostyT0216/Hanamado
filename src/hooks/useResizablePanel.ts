import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizablePanelOptions {
  /** 当前持久化的宽度 */
  width: number;
  /** 默认/最小宽度 */
  minWidth: number;
  /** 拖拽结束后的回调，用于持久化 */
  onChange: (width: number) => void;
  /** 是否允许拖拽（例如桌面端才启用） */
  enabled?: boolean;
}

/**
 * 让右侧面板左侧边缘可被拖拽调整宽度。
 * 最小宽度为 minWidth，最大宽度为当前视口宽度的一半。
 */
export function useResizablePanel({
  width,
  minWidth,
  onChange,
  enabled = true,
}: UseResizablePanelOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(width);
  const liveWidthRef = useRef(width);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      e.preventDefault();
      const startWidth = width;
      liveWidthRef.current = startWidth;
      setCurrentWidth(startWidth);
      setIsResizing(true);

      const handlePointerMove = (ev: PointerEvent) => {
        const maxWidth = Math.max(minWidth, window.innerWidth / 2);
        const nextWidth = Math.min(
          maxWidth,
          Math.max(minWidth, window.innerWidth - ev.clientX)
        );
        liveWidthRef.current = nextWidth;
        setCurrentWidth(nextWidth);
      };

      const handlePointerUp = () => {
        setIsResizing(false);
        onChange(liveWidthRef.current);
        window.removeEventListener('pointermove', handlePointerMove);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'w-resize';
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
    },
    [enabled, minWidth, onChange, width]
  );

  useEffect(() => {
    if (!isResizing) {
      setCurrentWidth(width);
      liveWidthRef.current = width;
    }
  }, [isResizing, width]);

  return {
    isResizing,
    handlePointerDown,
    currentWidth: isResizing ? currentWidth : width,
  };
}
