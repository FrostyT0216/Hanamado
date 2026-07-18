import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { VocabEntry, VocabLevel } from '@/types';

interface VocabState {
  // UI state (transient)
  isPanelOpen: boolean;
  activeTab: 'browse' | 'ai';
  selectedLevel: VocabLevel | null;
  selectedWord: VocabEntry | null;
  panelWidth: number;

  // Progress (persisted)
  learnedWords: string[];
  totalReviews: number;
  favoriteIds: string[];

  // Flashcard session (transient)
  flashcardQueue: VocabEntry[];
  flashcardIndex: number;
  isFlipped: boolean;
  isFlashcardActive: boolean;

  // UI state (transient)
  favoriteFilter: boolean;

  // Actions
  openPanel: () => void;
  closePanel: () => void;
  setActiveTab: (tab: 'browse' | 'ai') => void;
  setSelectedLevel: (level: VocabLevel) => void;
  setSelectedWord: (word: VocabEntry | null) => void;
  setPanelWidth: (width: number) => void;

  markLearned: (noteId: string) => void;
  markUnlearned: (noteId: string) => void;
  isLearned: (noteId: string) => boolean;

  markFavorite: (id: string) => void;
  markUnfavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleFavoriteFilter: () => void;

  // Flashcard actions
  initFlashcards: (entries: VocabEntry[]) => void;
  flipCard: () => void;
  nextCard: () => void;
  markFlashcardKnown: () => void;
  markFlashcardUnknown: () => void;
  resetFlashcards: () => void;
}

export const useVocabStore = create<VocabState>()(
  persist(
    (set, get) => {
      // Build a Set for O(1) lookup on each call
      const getLearnedSet = (): Set<string> => {
        return new Set(get().learnedWords);
      };

      return {
        // UI state
        isPanelOpen: false,
        activeTab: 'browse',
        selectedLevel: null,
        selectedWord: null,
        panelWidth: 480,

        // Progress
        learnedWords: [],
        totalReviews: 0,
        favoriteIds: [],

        // Flashcard session
        flashcardQueue: [],
        flashcardIndex: 0,
        isFlipped: false,
        isFlashcardActive: false,

        // UI state
        favoriteFilter: false,

        // Actions
        openPanel: () => set({ isPanelOpen: true }),
        closePanel: () =>
          set({
            isPanelOpen: false,
            isFlashcardActive: false,
            flashcardQueue: [],
            flashcardIndex: 0,
            isFlipped: false,
            favoriteFilter: false,
          }),
        setActiveTab: (tab) => set({ activeTab: tab }),
        setSelectedLevel: (level) =>
          set({ selectedLevel: level, selectedWord: null }),
        setSelectedWord: (word) => set({ selectedWord: word }),
        setPanelWidth: (width) => set({ panelWidth: width }),

        markLearned: (noteId) => {
          set((state) => ({
            learnedWords: state.learnedWords.includes(noteId)
              ? state.learnedWords
              : [...state.learnedWords, noteId],
            totalReviews: state.totalReviews + 1,
          }));
        },
        markUnlearned: (noteId) => {
          set((state) => ({
            learnedWords: state.learnedWords.filter((id) => id !== noteId),
          }));
        },
        isLearned: (noteId) => getLearnedSet().has(noteId),

        // Favorites
        markFavorite: (id) => {
          set((state) => ({
            favoriteIds: state.favoriteIds.includes(id)
              ? state.favoriteIds
              : [...state.favoriteIds, id],
          }));
        },
        markUnfavorite: (id) => {
          set((state) => ({
            favoriteIds: state.favoriteIds.filter((fid) => fid !== id),
          }));
        },
        isFavorite: (id) => {
          const set = new Set(get().favoriteIds);
          return set.has(id);
        },
        toggleFavoriteFilter: () => {
          set((state) => ({ favoriteFilter: !state.favoriteFilter }));
        },

        // Flashcard actions
        initFlashcards: (entries) => {
          const learned = getLearnedSet();
          const unlearned = entries.filter((e) => !learned.has(e.id));
          if (unlearned.length === 0) {
            set({
              flashcardQueue: [],
              flashcardIndex: 0,
              isFlipped: false,
              isFlashcardActive: false,
            });
            return;
          }
          // Fisher-Yates shuffle
          const shuffled = [...unlearned];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          set({
            flashcardQueue: shuffled,
            flashcardIndex: 0,
            isFlipped: false,
            isFlashcardActive: true,
          });
        },
        flipCard: () => set((state) => ({ isFlipped: !state.isFlipped })),
        nextCard: () => {
          const { flashcardQueue, flashcardIndex } = get();
          if (flashcardIndex >= flashcardQueue.length - 1) {
            set({
              isFlashcardActive: false,
              flashcardQueue: [],
              flashcardIndex: 0,
              isFlipped: false,
            });
          } else {
            set({
              flashcardIndex: flashcardIndex + 1,
              isFlipped: false,
            });
          }
        },
        markFlashcardKnown: () => {
          const { flashcardQueue, flashcardIndex } = get();
          const entry = flashcardQueue[flashcardIndex];
          if (entry) {
            get().markLearned(entry.id);
          }
          get().nextCard();
        },
        markFlashcardUnknown: () => {
          const { flashcardQueue, flashcardIndex } = get();
          const entry = flashcardQueue[flashcardIndex];
          if (entry) {
            // Move current card to the end of the queue
            const newQueue = [...flashcardQueue];
            newQueue.splice(flashcardIndex, 1);
            newQueue.push(entry);
            set({
              flashcardQueue: newQueue,
              isFlipped: false,
            });
          }
        },
        resetFlashcards: () => {
          set({
            flashcardQueue: [],
            flashcardIndex: 0,
            isFlipped: false,
            isFlashcardActive: false,
          });
        },
      };
    },
    {
      name: 'hanamado-vocab-progress',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        learnedWords: state.learnedWords,
        totalReviews: state.totalReviews,
        favoriteIds: state.favoriteIds,
        panelWidth: state.panelWidth,
      }),
    }
  )
);