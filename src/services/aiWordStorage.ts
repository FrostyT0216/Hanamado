import type { LocalAiEntry } from '@/types';

const COLLECTION_KEY = 'hanamado-ai-word-collection';

/** Load the entire AI word collection as a Record<word, LocalAiEntry> */
export function loadAiCollection(): Record<string, LocalAiEntry> {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, LocalAiEntry>;
  } catch {
    return {};
  }
}

/**
 * Save a word entry to the local AI collection.
 * Returns true on success, false on failure (e.g., localStorage quota exceeded).
 */
export function saveAiEntry(
  word: string,
  entry: Omit<LocalAiEntry, 'word' | 'savedAt'>
): boolean {
  try {
    const collection = loadAiCollection();
    collection[word] = {
      word,
      ...entry,
      savedAt: Date.now(),
    };
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
    window.dispatchEvent(new CustomEvent('hanamado-ai-word-saved', { detail: { word } }));
    return true;
  } catch (e) {
    console.warn('[AI Word Storage] Failed to save entry:', e);
    return false;
  }
}

/** Check if a word is already in the local AI collection */
export function isInCollection(word: string): boolean {
  const collection = loadAiCollection();
  return word in collection;
}

/** Get a word entry from the local AI collection, or null if not found */
export function getAiEntry(word: string): LocalAiEntry | null {
  const collection = loadAiCollection();
  return collection[word] ?? null;
}

/** Remove an entry from the local AI collection */
export function removeAiEntry(word: string): boolean {
  try {
    const collection = loadAiCollection();
    delete collection[word];
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
    window.dispatchEvent(new CustomEvent('hanamado-ai-word-removed', { detail: { word } }));
    return true;
  } catch {
    return false;
  }
}

/** Get the total number of entries in the local AI collection */
export function getCollectionSize(): number {
  return Object.keys(loadAiCollection()).length;
}