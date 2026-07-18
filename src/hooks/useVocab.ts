import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useVocabStore } from '@/store/vocabStore';
import {
  loadIndex,
  loadLevel,
  getEntries,
  isLevelReady,
  isIndexReady,
} from '@/services/vocabService';
import type { VocabLevel, VocabEntry, VocabIndex } from '@/types';

/**
 * Debounced version of a value. Returns the value only after it has been
 * stable for `delay` ms.
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Client-side search across kanji, furigana, definition, notes, and POS.
 * Splits query by whitespace — all tokens must match (AND logic).
 */
function searchLocal(entries: VocabEntry[], query: string): VocabEntry[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());

  if (tokens.length === 0) return entries;

  return entries.filter((entry) => {
    const haystack = [
      entry.kanji,
      entry.furigana,
      entry.definition,
      entry.notes,
      entry.pos,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}

export function useVocab() {
  const selectedLevel = useVocabStore((s) => s.selectedLevel);
  const learnedWords = useVocabStore((s) => s.learnedWords);

  const [index, setIndex] = useState<VocabIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawSearchQuery, setRawSearchQuery] = useState('');

  // Bump this counter every time data finishes loading so useMemo
  // entries picks up the fresh data from the service cache.
  const [dataVersion, setDataVersion] = useState(0);

  // Debounce search to avoid filtering on every keystroke
  const searchQuery = useDebounce(rawSearchQuery, 150);

  // Derived loading state — true while the selected level's data
  // hasn't been fetched yet. Reacts immediately on level change
  // (no one-frame flash of "empty").
  const isLoading = useMemo(() => {
    if (!selectedLevel) return false;
    return !isLevelReady(selectedLevel);
  }, [selectedLevel, dataVersion]);

  // Load index on mount
  useEffect(() => {
    if (isIndexReady()) {
      loadIndex().then(setIndex).catch(console.warn);
    } else {
      loadIndex()
        .then(setIndex)
        .catch((err) => setError(err.message));
    }
  }, []);

  // Load level data when selected level changes
  const loadingRef = useRef<VocabLevel | null>(null);
  useEffect(() => {
    if (!selectedLevel) return;
    if (isLevelReady(selectedLevel)) {
      setDataVersion((v) => v + 1);
      return;
    }

    // Prevent duplicate loads
    if (loadingRef.current === selectedLevel) return;
    loadingRef.current = selectedLevel;

    setError(null);
    loadLevel(selectedLevel)
      .then(() => {
        setDataVersion((v) => v + 1);
        loadingRef.current = null;
      })
      .catch((err) => {
        setError(err.message);
        loadingRef.current = null;
      });
  }, [selectedLevel]);

  // Get entries for current level — depends on dataVersion so it
  // re-computes after async load completes.
  const entries = useMemo(() => {
    if (!selectedLevel) return [];
    return getEntries(selectedLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel, dataVersion]);

  // Filter by debounced search query
  const filteredEntries = useMemo(() => {
    if (!selectedLevel) return [];
    if (!searchQuery.trim()) return entries;
    return searchLocal(entries, searchQuery);
  }, [selectedLevel, entries, searchQuery]);

  // Get unlearned entries for flashcard
  const getUnlearnedEntries = useCallback(
    (level: VocabLevel): VocabEntry[] => {
      const learned = new Set(learnedWords);
      return getEntries(level).filter((e) => !learned.has(e.id));
    },
    [learnedWords]
  );

  return {
    index,
    entries,
    filteredEntries,
    isLoading,
    error,
    searchQuery: rawSearchQuery,
    setSearchQuery: setRawSearchQuery,
    getUnlearnedEntries,
  };
}