import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  DictationResultRecord,
  DictationSettings,
  DictationSummary,
} from '@/types';

interface DictationState {
  // ============ 持久化 ============
  settings: DictationSettings;

  // ============ 会话瞬态 ============
  isDictationActive: boolean;
  currentQueue: string[];       // wordIds
  currentIndex: number;
  results: DictationResultRecord[];
  sessionStartedAt: number | null;

  // ============ 结果摘要 ============
  lastSummary: DictationSummary | null;

  // ============ Actions ============
  setSettings: (partial: Partial<DictationSettings>) => void;
  startSession: (wordIds: string[]) => void;
  recordResult: (record: DictationResultRecord) => void;
  nextWord: () => void;
  exitSession: (completed?: boolean) => void;
  clearLastSummary: () => void;
}

const DEFAULT_SETTINGS: DictationSettings = {
  source: 'learning',
  batchSize: 10,
  autoPlayAudio: true,
};

function emptyTransient() {
  return {
    isDictationActive: false,
    currentQueue: [],
    currentIndex: 0,
    results: [],
    sessionStartedAt: null,
  };
}

export const useDictationStore = create<DictationState>()(
  persist(
    (set, get) => ({
      // ============ 持久化 ============
      settings: DEFAULT_SETTINGS,

      // ============ 瞬态 ============
      ...emptyTransient(),
      lastSummary: null,

      // ============ Actions ============
      setSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      startSession: (wordIds) =>
        set({
          ...emptyTransient(),
          isDictationActive: true,
          currentQueue: wordIds,
          currentIndex: 0,
          results: [],
          sessionStartedAt: Date.now(),
        }),

      recordResult: (record) =>
        set((state) => ({
          results: [...state.results, record],
        })),

      nextWord: () => {
        const { currentIndex, currentQueue } = get();
        if (currentIndex >= currentQueue.length - 1) return;
        set({ currentIndex: currentIndex + 1 });
      },

      exitSession: (completed = false) => {
        const { results, sessionStartedAt } = get();
        const summary: DictationSummary | null =
          completed && sessionStartedAt
            ? {
                total: results.length,
                correct: results.filter((r) => r.correct).length,
                results,
                durationMs: Date.now() - sessionStartedAt,
              }
            : null;
        set({
          ...emptyTransient(),
          lastSummary: summary,
        });
      },

      clearLastSummary: () => set({ lastSummary: null }),
    }),
    {
      name: 'hanamado-dictation',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
