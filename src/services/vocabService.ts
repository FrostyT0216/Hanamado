import type { VocabEntry, VocabIndex, VocabLevel } from '@/types';

const vocabData: Map<VocabLevel, VocabEntry[]> = new Map();
let indexData: VocabIndex | null = null;
const loadPromises: Map<VocabLevel, Promise<void>> = new Map();

// ---------------------------------------------------------------------------
// Lightweight search index — loaded once, used for O(1) token lookups
// ---------------------------------------------------------------------------

type SearchIndex = Record<string, [string, VocabLevel][]>;
let searchIndex: SearchIndex | null = null;
let searchIndexPromise: Promise<SearchIndex> | null = null;

export async function loadSearchIndex(): Promise<SearchIndex> {
  if (searchIndex) return searchIndex;
  if (searchIndexPromise) return searchIndexPromise;

  searchIndexPromise = fetch('/data/vocab-search.json')
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load search index: ${res.status}`);
      return res.json();
    })
    .then((data: SearchIndex) => {
      searchIndex = data;
      return data;
    })
    .catch((err) => {
      searchIndexPromise = null;
      throw err;
    });

  return searchIndexPromise;
}

/**
 * Look up a word in the search index. Returns matching [id, level] pairs.
 * Returns null if the index is not loaded yet (caller should await loadSearchIndex).
 */
export function lookupInSearchIndex(word: string): [string, VocabLevel][] | null {
  if (!searchIndex) return null;
  // Try exact match, then try stripping punctuation
  return searchIndex[word] || searchIndex[word.replace(/[「」『』（）。、！？…]/g, '')] || null;
}

export function isSearchIndexReady(): boolean {
  return searchIndex !== null;
}

// ---------------------------------------------------------------------------
// Level data
// ---------------------------------------------------------------------------

export async function loadIndex(signal?: AbortSignal): Promise<VocabIndex> {
  if (indexData) return indexData;

  const response = await fetch('/data/vocab-index.json', { signal });
  if (!response.ok) {
    throw new Error(`Failed to load vocab index: ${response.status}`);
  }
  indexData = await response.json();
  return indexData!;
}

export async function loadLevel(level: VocabLevel, signal?: AbortSignal): Promise<void> {
  if (vocabData.has(level)) return;

  const existing = loadPromises.get(level);
  if (existing) return existing;

  // Ensure index is loaded so we know the file name
  const index = await loadIndex(signal);
  const levelMeta = index.levels[level];
  if (!levelMeta) {
    throw new Error(`Level ${level} not found in vocab index`);
  }

  const promise = fetch(`/data/${levelMeta.file}`, { signal })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load ${levelMeta.file}: ${res.status}`);
      }
      return res.json();
    })
    .then((data: VocabEntry[]) => {
      vocabData.set(level, data);
      loadPromises.delete(level);
    })
    .catch((err) => {
      loadPromises.delete(level);
      throw err;
    });

  loadPromises.set(level, promise);
  return promise;
}

export function getEntries(level: VocabLevel): VocabEntry[] {
  return vocabData.get(level) || [];
}

export function getEntryById(id: string): VocabEntry | null {
  for (const entries of vocabData.values()) {
    const found = entries.find((e) => e.id === id);
    if (found) return found;
  }
  return null;
}

export function searchEntries(
  level: VocabLevel,
  query: string
): VocabEntry[] {
  const entries = getEntries(level);
  if (!query.trim()) return entries;

  const q = query.toLowerCase();
  return entries.filter(
    (e) =>
      e.kanji.toLowerCase().includes(q) ||
      e.furigana.toLowerCase().includes(q) ||
      e.definition.toLowerCase().includes(q)
  );
}

export function isLevelReady(level: VocabLevel): boolean {
  return vocabData.has(level);
}

export function isIndexReady(): boolean {
  return indexData !== null;
}

export function getLevelCount(level: VocabLevel): number {
  return getEntries(level).length;
}

// ---------------------------------------------------------------------------
// id -> level 反查映射（用于在 level 数据未加载时确定词所属 level）
// ---------------------------------------------------------------------------

let idToLevelMap: Map<string, VocabLevel> | null = null;
let idToLevelPromise: Promise<Map<string, VocabLevel>> | null = null;

/**
 * 构建 id -> level 的映射（一次性，结果缓存）。
 * 依赖 search index，若未加载会自动加载。
 */
export async function buildIdToLevelMap(): Promise<Map<string, VocabLevel>> {
  if (idToLevelMap) return idToLevelMap;
  if (idToLevelPromise) return idToLevelPromise;

  idToLevelPromise = (async () => {
    if (!isSearchIndexReady()) {
      await loadSearchIndex();
    }
    const map = new Map<string, VocabLevel>();
    // searchIndex 是模块级变量，这里直接访问
    if (searchIndex) {
      for (const matches of Object.values(searchIndex)) {
        for (const [id, level] of matches) {
          if (!map.has(id)) map.set(id, level);
        }
      }
    }
    idToLevelMap = map;
    return map;
  })();

  return idToLevelPromise;
}

/**
 * 通过 wordId 反查其所属 level。
 * 优先从已加载的 level 数据中查找；若未加载则构建 id->level 映射反查。
 */
export async function findLevelById(id: string): Promise<VocabLevel | null> {
  // 1. 优先从已加载的 level 数据中查找
  const entry = getEntryById(id);
  if (entry) return entry.level;
  // 2. 从 wordProgress 无法获取时，使用 search index 反查
  try {
    const map = await buildIdToLevelMap();
    return map.get(id) ?? null;
  } catch {
    return null;
  }
}