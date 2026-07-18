import { useState, useCallback, type RefObject } from 'react';

interface TextSelectionState {
  selectedText: string;
  selectionRect: DOMRect | null;
}

export function useTextSelection(containerRef: RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelectionState>({
    selectedText: '',
    selectionRect: null,
  });

  const handleMouseUp = useCallback(() => {
    // Small delay to let the selection settle
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection({ selectedText: '', selectionRect: null });
        return;
      }

      const text = sel.toString().trim();
      if (!text) {
        setSelection({ selectedText: '', selectionRect: null });
        return;
      }

      // Check if selection is within our container
      if (
        containerRef.current &&
        sel.anchorNode &&
        containerRef.current.contains(sel.anchorNode)
      ) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelection({ selectedText: text, selectionRect: rect });
      }
    }, 50);
  }, [containerRef]);

  const clearSelection = useCallback(() => {
    setSelection({ selectedText: '', selectionRect: null });
    window.getSelection()?.removeAllRanges();
  }, []);

  return { ...selection, clearSelection, handleMouseUp };
}