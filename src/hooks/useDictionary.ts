import { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import { initialize, lookup, isReady } from '@/services/dictionary';
import {
  loadSearchIndex,
  lookupInSearchIndex,
  isSearchIndexReady,
  loadLevel,
  getEntryById,
} from '@/services/vocabService';
import { queryWordWithAI as queryWordWithAIService } from '@/services/ai';
import { saveAiEntry, isInCollection, getAiEntry } from '@/services/aiWordStorage';
import type { AiWordEntry, DictEntry, VocabEntry } from '@/types';

interface LookupResult {
  entry: DictEntry | null;
  vocabEntry: VocabEntry | null;
  source: 'local' | 'vocab' | 'ai' | null;
  isLoading: boolean;
  error: string | null;
}

export function useDictionary() {
  const [dictReady, setDictReady] = useState(isReady());
  const [vocabReady, setVocabReady] = useState(isSearchIndexReady());
  const apiConfig = useChatStore((s) => s.apiConfig);

  // Load small dictionary
  useEffect(() => {
    if (dictReady) return;
    initialize()
      .then(() => setDictReady(true))
      .catch(() => setDictReady(false));
  }, [dictReady]);

  // Load JLPT vocab search index
  useEffect(() => {
    if (vocabReady) return;
    loadSearchIndex()
      .then(() => setVocabReady(true))
      .catch(() => setVocabReady(false));
  }, [vocabReady]);

  const lookupWord = useCallback(
    (word: string): LookupResult => {
      // 1. Small dictionary
      if (dictReady) {
        const entry = lookup(word);
        if (entry) {
          return { entry, vocabEntry: null, source: 'local', isLoading: false, error: null };
        }
      }

      // 2. JLPT vocab search index — fast O(1) lookup
      if (vocabReady) {
        const matches = lookupInSearchIndex(word);
        if (matches && matches.length > 0) {
          // Found in index — caller will load full entry via loadVocabEntry().
          // isLoading is false here because the index lookup is synchronous;
          // the caller manages its own loading state for the full entry fetch.
          return {
            entry: null,
            vocabEntry: null,
            source: 'vocab',
            isLoading: false,
            error: null,
          };
        }
      }

      // 3. AI word collection (localStorage cache)
      const aiEntry = getAiEntry(word);
      if (aiEntry) {
        return {
          entry: null,
          vocabEntry: null,
          source: 'ai',
          isLoading: false,
          error: null,
        };
      }

      // 4. Still loading (either dict or search index not ready)
      if (!dictReady || !vocabReady) {
        return { entry: null, vocabEntry: null, source: null, isLoading: true, error: null };
      }

      // 4. Not found anywhere
      return { entry: null, vocabEntry: null, source: null, isLoading: false, error: null };
    },
    [dictReady, vocabReady]
  );

  /**
   * Load the full VocabEntry for a word found in the search index.
   */
  const loadVocabEntry = useCallback(async (word: string): Promise<VocabEntry | null> => {
    if (!vocabReady) return null;

    const matches = lookupInSearchIndex(word);
    if (!matches || matches.length === 0) return null;

    // Take the first match
    const [id, level] = matches[0];

    // Check if the level data is already loaded
    const cached = getEntryById(id);
    if (cached) return cached;

    // Load the level, then look up the entry
    try {
      await loadLevel(level);
      return getEntryById(id);
    } catch {
      return null;
    }
  }, [vocabReady]);

  const queryWordWithAI = useCallback(
    async (word: string): Promise<AiWordEntry | null> => {
      if (!apiConfig) return null;
      try {
        const result = await queryWordWithAIService(apiConfig, word);

        // Auto-save to local AI collection if not already present
        if (!isInCollection(word)) {
          saveAiEntry(word, {
            dictionary_form: result.dictionary_form,
            kana_form: result.kana_form,
            romaji: result.romaji,
            pitch: result.pitch,
            parts_of_speech: result.parts_of_speech,
            definition: result.definition,
            example_sentences: result.example_sentences,
          });
        }

        return result;
      } catch {
        return null;
      }
    },
    [apiConfig]
  );

  return { lookupWord, loadVocabEntry, queryWordWithAI, isDictReady: dictReady };
}