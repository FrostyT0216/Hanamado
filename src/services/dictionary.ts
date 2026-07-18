import type { DictEntry } from '@/types';

let dictData: Record<string, DictEntry> | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

export async function initialize(): Promise<void> {
  if (dictData) return;
  if (loadPromise) return loadPromise;

  isLoading = true;
  loadPromise = fetch('/dict/jmdict-zh.json')
    .then((res) => res.json())
    .then((data) => {
      dictData = data;
      isLoading = false;
    })
    .catch((err) => {
      isLoading = false;
      loadPromise = null;
      console.warn('Failed to load dictionary:', err);
    });

  return loadPromise;
}

export function lookup(word: string): DictEntry | null {
  if (!dictData) return null;

  // Exact match
  if (dictData[word]) return dictData[word];

  // Try alternative forms (simple heuristics)
  const altForms = [word, word.replace(/[「」『』（）。、！？…]/g, '')];
  for (const form of altForms) {
    if (form && dictData[form]) return dictData[form];
  }

  return null;
}

export function isReady(): boolean {
  return dictData !== null;
}

export function getEntryCount(): number {
  return dictData ? Object.keys(dictData).length : 0;
}