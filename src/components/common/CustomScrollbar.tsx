import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/utils/cn';
import GameIcon from '@/components/common/GameIcon';
import type { IconName } from '@/components/icons/iconData';

const THUMB_MIN_HEIGHT = 32;

const SCROLLBAR_ICONS: IconName[] = [
  'slider',
  'arrowUp',
  'arrowDown',
  'circleRing',
  'sortHandle',
];

interface CustomScrollbarProps {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
}

const CustomScrollbar = forwardRef<HTMLDivElement, CustomScrollbarProps>(
  ({ children, className, viewportClassName }, ref) => {
    const viewportRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => viewportRef.current!);
    const trackRef = useRef<HTMLDivElement>(null);
    const [thumbHeight, setThumbHeight] = useState(0);
    const [thumbTop, setThumbTop] = useState(0);
    const [canScroll, setCanScroll] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const dragStateRef = useRef<{
      startY: number;
      startScrollTop: number;
      trackHeight: number;
      scrollHeight: number;
      viewportHeight: number;
    } | null>(null);

    const randomIcon = useMemo(
      () => SCROLLBAR_ICONS[Math.floor(Math.random() * SCROLLBAR_ICONS.length)],
      []
    );

    const updateThumb = useCallback(() => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) return;

      const { scrollHeight, clientHeight, scrollTop } = viewport;
      const trackHeight = track.clientHeight;

      if (scrollHeight <= clientHeight) {
        setCanScroll(false);
        setThumbHeight(0);
        setThumbTop(0);
        return;
      }

      setCanScroll(true);
      const ratio = clientHeight / scrollHeight;
      const height = Math.max(THUMB_MIN_HEIGHT, ratio * trackHeight);
      const maxScrollTop = scrollHeight - clientHeight;
      const maxThumbTop = trackHeight - height;
      const top =
        maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;

      setThumbHeight(height);
      setThumbTop(top);
    }, []);

    const handleScroll = useCallback(() => {
      updateThumb();
    }, [updateThumb]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      e.preventDefault();
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) return;

      setIsDragging(true);
      isDraggingRef.current = true;

      const trackHeight = track.clientHeight;
      const scrollHeight = viewport.scrollHeight;
      const viewportHeight = viewport.clientHeight;

      dragStateRef.current = {
        startY: e.clientY,
        startScrollTop: viewport.scrollTop,
        trackHeight,
        scrollHeight,
        viewportHeight,
      };

      const handleMove = (ev: PointerEvent) => {
        if (!dragStateRef.current || !viewport) return;
        const { startY, startScrollTop, trackHeight, scrollHeight, viewportHeight } =
          dragStateRef.current;
        const deltaY = ev.clientY - startY;
        const maxScrollTop = scrollHeight - viewportHeight;
        const currentThumbHeight = Math.max(
          THUMB_MIN_HEIGHT,
          (viewportHeight / scrollHeight) * trackHeight
        );
        const maxThumbTop = trackHeight - currentThumbHeight;
        if (maxThumbTop <= 0) return;
        const scrollRatio = deltaY / maxThumbTop;
        viewport.scrollTop = Math.max(
          0,
          Math.min(maxScrollTop, startScrollTop + scrollRatio * maxScrollTop)
        );
      };

      const handleUp = () => {
        setIsDragging(false);
        isDraggingRef.current = false;
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    }, []);

    useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      updateThumb();
      viewport.addEventListener('scroll', handleScroll, { passive: true });

      const resizeObserver = new ResizeObserver(() => {
        updateThumb();
      });
      resizeObserver.observe(viewport);

      const mutationObserver = new MutationObserver(() => {
        updateThumb();
      });
      mutationObserver.observe(viewport, {
        childList: true,
        subtree: true,
      });

      return () => {
        viewport.removeEventListener('scroll', handleScroll);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
      };
    }, [handleScroll, updateThumb]);

    return (
      <div
        className={cn(
          'custom-scrollbar relative overflow-hidden',
          className
        )}
      >
        <div
          ref={viewportRef}
          className={cn(
            'custom-scrollbar-viewport h-full w-full overflow-y-auto overflow-x-hidden',
            viewportClassName
          )}
        >
          {children}
        </div>

        <div
          ref={trackRef}
          className={cn(
            'custom-scrollbar-track absolute right-1.5 top-1.5 bottom-1.5 w-2 rounded-full',
            'transition-opacity duration-200',
            canScroll ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
          aria-hidden="true"
        >
          {thumbHeight > 0 && (
            <div
              className={cn(
                'custom-scrollbar-thumb absolute right-0 left-0 rounded-full',
                'flex items-center justify-center cursor-pointer',
                'transition-[top,background-color,transform] duration-75 ease-out',
                isDragging ? 'scale-110' : 'hover:scale-105'
              )}
              style={{
                height: thumbHeight,
                top: thumbTop,
              }}
              onPointerDown={handlePointerDown}
            >
              {thumbHeight >= 22 && (
                <GameIcon
                  name={randomIcon}
                  className="custom-scrollbar-thumb-icon w-3 h-3"
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

CustomScrollbar.displayName = 'CustomScrollbar';

export default CustomScrollbar;
