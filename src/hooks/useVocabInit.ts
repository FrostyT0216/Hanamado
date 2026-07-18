import { useState, useEffect } from 'react';
import {
  loadIndex,
  loadSearchIndex,
  isIndexReady,
  isSearchIndexReady,
} from '@/services/vocabService';

interface VocabInitState {
  isLoading: boolean;
  progress: number; // 0 to 1
  error: string | null;
}

/**
 * Auto-load the JLPT vocab index and search index on app startup.
 * This ensures the vocab panel is ready immediately when the user opens it,
 * and the dictionary lookup chain benefits from the pre-loaded search index.
 */
export function useVocabInit(): VocabInitState {
  const [state, setState] = useState<VocabInitState>({
    isLoading: !isIndexReady() || !isSearchIndexReady(),
    progress: 0,
    error: null,
  });

  useEffect(() => {
    // If already loaded (e.g., from a previous mount), skip
    if (isIndexReady() && isSearchIndexReady()) {
      setState({ isLoading: false, progress: 1, error: null });
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        setState((s) => ({ ...s, progress: 0.1 }));

        // Load both in parallel
        const indexPromise = isIndexReady()
          ? Promise.resolve()
          : loadIndex();
        const searchPromise = isSearchIndexReady()
          ? Promise.resolve()
          : loadSearchIndex();

        await Promise.all([indexPromise, searchPromise]);

        if (!cancelled) {
          setState({ isLoading: false, progress: 1, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            isLoading: false,
            progress: 0,
            error: err instanceof Error ? err.message : 'Failed to load vocab data',
          });
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}