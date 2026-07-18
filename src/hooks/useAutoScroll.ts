import { useEffect, useRef, type RefObject } from 'react';

export function useAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  dependencies: unknown[]
) {
  const userScrolledUp = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // If user is within 100px of the bottom, consider them "at bottom"
      userScrolledUp.current = scrollHeight - scrollTop - clientHeight > 100;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || userScrolledUp.current) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}