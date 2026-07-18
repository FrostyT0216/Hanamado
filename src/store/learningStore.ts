import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AiReviewQuiz,
  LearningBatch,
  LearningSettings,
  WordProgress,
} from '@/types';
import {
  applyReviewResult,
  createInitialProgress,
  isReviewDue,
  judgeReviewPass,
} from '@/services/learningService';

// 学习瞬态：用于「新词学习卡片 + 即时练习」流程
// learningPhase: 'card' = 显示卡片；'quiz' = 即时练习阶段
export type LearningPhase = 'card' | 'quiz';

// 复习单题作答记录（用于结果展示）
export interface ReviewAnswerRecord {
  wordId: string;
  questionIndex: number;
  question: AiReviewQuiz['questions'][number];
  selected: number;
  correct: boolean;
}

/** 练习结束后的结果摘要 */
export type LearningResult =
  | { type: 'new'; wordCount: number; wrongCount: number }
  | { type: 'review'; answers: ReviewAnswerRecord[] };

interface LearningState {
  // ============ 持久化 ============
  wordProgress: Record<string, WordProgress>;
  batches: LearningBatch[];
  settings: LearningSettings;

  // ============ 新词学习瞬态 ============
  isLearningActive: boolean;
  learningPhase: LearningPhase;
  currentBatchWordIds: string[];
  currentLearningIndex: number;     // 当前学到的词
  currentPracticeQueue: AiReviewQuiz['questions']; // 即时练习题目队列（错题放回末尾）
  currentPracticeIndex: number;
  practiceWordId: string | null;   // 当前正在练习的词
  practiceWrongCount: number;      // 练习错题总数（用于统计）

  // ============ 新词批次后台预出题 ============
  batchPracticeQuizzes: Record<string, AiReviewQuiz>;
  isBatchQuizLoading: boolean;
  batchQuizLoadedCount: number;
  batchQuizError: string | null;

  // ============ 复习瞬态 ============
  isReviewActive: boolean;
  currentReviewQueue: string[];    // wordId 列表
  currentReviewIndex: number;
  currentQuiz: AiReviewQuiz | null;
  isQuizLoading: boolean;
  reviewAnswers: ReviewAnswerRecord[]; // 本次复习全部作答记录

  // ============ 结果摘要（练习结束后展示） ============
  lastResult: LearningResult | null;

  // ============ Actions ============
  // Settings
  setSettings: (partial: Partial<LearningSettings>) => void;

  // New word learning
  startNewBatch: (wordIds: string[]) => void;
  setLearningPhase: (phase: LearningPhase) => void;
  nextLearningCard: () => void;
  startPracticeForWord: (wordId: string, quiz: AiReviewQuiz) => void;
  /** 答错时把当前题放回队列末尾，索引保持不变 */
  requeueCurrentPracticeQuestion: () => void;
  /** 答对时进入下一题；若已到末尾则完成该词练习 */
  advancePracticeQuestion: () => void;
  completeBatch: () => void;
  exitLearning: () => void;
  // 批次后台预出题
  startBatchQuizGeneration: (wordIds: string[]) => void;
  setBatchQuizLoaded: (wordId: string, quiz: AiReviewQuiz) => void;
  setBatchQuizError: (error: string) => void;
  startBatchPractice: () => void;

  // Review
  startReview: (wordIds: string[]) => void;
  setCurrentQuiz: (quiz: AiReviewQuiz | null) => void;
  setQuizLoading: (v: boolean) => void;
  recordReviewAnswer: (record: ReviewAnswerRecord) => void;
  /** 完成当前词的复习，传入该词本次作答的对错数 */
  finishReviewWord: (correct: number, total: number) => void;
  exitReview: (completed?: boolean) => void;

  // Result
  clearLastResult: () => void;

  // Getters
  getTodayDueReviews: () => string[];
  getTodayNewWordCount: () => number;
  getMasteredCount: () => number;
  getStageDistribution: () => { new: number; learning: number; mastered: number };
  getFutureReviewSchedule: (days: number) => { date: Date; count: number }[];
}

const DEFAULT_SETTINGS: LearningSettings = {
  batchSize: 10,
  dailyNewWordLimit: 10,
  source: 'jlpt',
  selectedLevel: 'N5',
};

function emptyLearningTransient() {
  return {
    isLearningActive: false,
    learningPhase: 'card' as LearningPhase,
    currentBatchWordIds: [],
    currentLearningIndex: 0,
    currentPracticeQueue: [],
    currentPracticeIndex: 0,
    practiceWordId: null,
    practiceWrongCount: 0,
    batchPracticeQuizzes: {},
    isBatchQuizLoading: false,
    batchQuizLoadedCount: 0,
    batchQuizError: null,
  };
}

function emptyReviewTransient() {
  return {
    isReviewActive: false,
    currentReviewQueue: [],
    currentReviewIndex: 0,
    currentQuiz: null,
    isQuizLoading: false,
    reviewAnswers: [] as ReviewAnswerRecord[],
  };
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set, get) => {
      const startOfDay = (d: number): number => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      };

      return {
        // ============ 持久化 ============
        wordProgress: {},
        batches: [],
        settings: DEFAULT_SETTINGS,

        // ============ 瞬态 ============
        ...emptyLearningTransient(),
        ...emptyReviewTransient(),
        lastResult: null,

        // ============ Settings ============
        setSettings: (partial) =>
          set((state) => ({
            settings: { ...state.settings, ...partial },
          })),

        // ============ 新词学习 ============
        startNewBatch: (wordIds) =>
          set({
            ...emptyLearningTransient(),
            isLearningActive: true,
            learningPhase: 'card',
            currentBatchWordIds: wordIds,
            currentLearningIndex: 0,
          }),

        setLearningPhase: (phase) => set({ learningPhase: phase }),

        nextLearningCard: () => {
          const { currentLearningIndex, currentBatchWordIds } = get();
          if (currentLearningIndex >= currentBatchWordIds.length - 1) {
            // 已是最后一张，由 completeBatch 处理
            return;
          }
          set({
            currentLearningIndex: currentLearningIndex + 1,
            learningPhase: 'card',
            currentPracticeQueue: [],
            currentPracticeIndex: 0,
            practiceWordId: null,
            practiceWrongCount: 0,
          });
        },

        startPracticeForWord: (wordId, quiz) =>
          set({
            learningPhase: 'quiz',
            practiceWordId: wordId,
            currentPracticeQueue: quiz.questions,
            currentPracticeIndex: 0,
            practiceWrongCount: 0,
          }),

        requeueCurrentPracticeQuestion: () =>
          set((state) => {
            const queue = state.currentPracticeQueue;
            if (queue.length === 0) return {};
            const current = queue[state.currentPracticeIndex];
            // 把当前题移到末尾，索引保持不变（这样下次「下一题」拿到的还是同位置的新题）
            const newQueue = [...queue];
            newQueue.splice(state.currentPracticeIndex, 1);
            newQueue.push(current);
            return {
              currentPracticeQueue: newQueue,
              practiceWrongCount: state.practiceWrongCount + 1,
            };
          }),

        advancePracticeQuestion: () => {
          const { currentPracticeIndex, currentPracticeQueue } = get();
          if (currentPracticeIndex >= currentPracticeQueue.length - 1) {
            // 已到末尾，完成该词练习
            set({
              currentPracticeQueue: [],
              currentPracticeIndex: 0,
              practiceWordId: null,
            });
            // 切换回 card 阶段，由组件触发 nextLearningCard
            return;
          }
          set({ currentPracticeIndex: currentPracticeIndex + 1 });
        },

        completeBatch: () => {
          const { currentBatchWordIds, settings, batches, wordProgress, practiceWrongCount } = get();
          const now = Date.now();
          const newProgress: Record<string, WordProgress> = { ...wordProgress };
          for (const wordId of currentBatchWordIds) {
            if (newProgress[wordId]) continue; // 已有进度不覆盖
            const source: 'jlpt' | 'ai' = settings.source === 'ai' ? 'ai' : 'jlpt';
            const level = source === 'jlpt' ? settings.selectedLevel : undefined;
            newProgress[wordId] = createInitialProgress(wordId, source, level, now);
          }
          const batch: LearningBatch = {
            id: `batch-${now}`,
            createdAt: now,
            source: settings.source === 'ai' ? 'ai' : 'jlpt',
            level: settings.source === 'jlpt' ? settings.selectedLevel : undefined,
            wordIds: [...currentBatchWordIds],
            size: currentBatchWordIds.length,
          };
          set({
            wordProgress: newProgress,
            batches: [...batches, batch],
            ...emptyLearningTransient(),
            lastResult: {
              type: 'new',
              wordCount: currentBatchWordIds.length,
              wrongCount: practiceWrongCount,
            },
          });
        },

        exitLearning: () => set({ ...emptyLearningTransient() }),

        startBatchQuizGeneration: (wordIds) =>
          set({
            batchPracticeQuizzes: {},
            isBatchQuizLoading: true,
            batchQuizLoadedCount: 0,
            batchQuizError: null,
          }),

        setBatchQuizLoaded: (wordId, quiz) =>
          set((state) => ({
            batchPracticeQuizzes: { ...state.batchPracticeQuizzes, [wordId]: quiz },
            batchQuizLoadedCount: state.batchQuizLoadedCount + 1,
          })),

        setBatchQuizError: (error) =>
          set({ isBatchQuizLoading: false, batchQuizError: error }),

        startBatchPractice: () =>
          set((state) => {
            const queue = state.currentBatchWordIds.flatMap(
              (id) => state.batchPracticeQuizzes[id]?.questions ?? []
            );
            return {
              learningPhase: 'quiz',
              currentPracticeQueue: queue,
              currentPracticeIndex: 0,
              practiceWordId: null,
              practiceWrongCount: 0,
              isBatchQuizLoading: false,
            };
          }),

        // ============ 复习 ============
        startReview: (wordIds) =>
          set({
            ...emptyReviewTransient(),
            isReviewActive: true,
            currentReviewQueue: wordIds,
            currentReviewIndex: 0,
          }),

        setCurrentQuiz: (quiz) => set({ currentQuiz: quiz }),
        setQuizLoading: (v) => set({ isQuizLoading: v }),

        recordReviewAnswer: (record) =>
          set((state) => ({
            reviewAnswers: [...state.reviewAnswers, record],
          })),

        finishReviewWord: (correct, total) => {
          const { currentReviewQueue, currentReviewIndex, wordProgress } = get();
          const wordId = currentReviewQueue[currentReviewIndex];
          if (!wordId) return;
          const existing = wordProgress[wordId];
          if (!existing) return;
          const passed = judgeReviewPass(correct, total);
          const updated = applyReviewResult(existing, passed, correct, total);
          set((state) => ({
            wordProgress: {
              ...state.wordProgress,
              [wordId]: updated,
            },
          }));
        },

        exitReview: (completed = false) => {
          const { reviewAnswers } = get();
          set({
            ...emptyReviewTransient(),
            lastResult:
              completed && reviewAnswers.length > 0
                ? { type: 'review', answers: reviewAnswers }
                : null,
          });
        },

        clearLastResult: () => set({ lastResult: null }),

        // ============ Getters ============
        getTodayDueReviews: () => {
          const { wordProgress } = get();
          const now = Date.now();
          return Object.values(wordProgress)
            .filter((p) => isReviewDue(p, now))
            .map((p) => p.wordId);
        },

        getTodayNewWordCount: () => {
          const { batches, settings } = get();
          const todayStart = startOfDay(Date.now());
          let count = 0;
          for (const batch of batches) {
            if (batch.createdAt >= todayStart) {
              count += batch.size;
            }
          }
          // 今日剩余可学 = 每日上限 - 已学
          return Math.max(0, settings.dailyNewWordLimit - count);
        },

        getMasteredCount: () => {
          const { wordProgress } = get();
          return Object.values(wordProgress).filter((p) => p.status === 'mastered').length;
        },

        getStageDistribution: () => {
          const { wordProgress } = get();
          const result = { new: 0, learning: 0, mastered: 0 };
          // 「new」用所有候选词数 - 已记录进度的
          for (const p of Object.values(wordProgress)) {
            if (p.status === 'mastered') result.mastered++;
            else if (p.status === 'learning') result.learning++;
          }
          return result;
        },

        getFutureReviewSchedule: (days) => {
          const { wordProgress } = get();
          const result: { date: Date; count: number }[] = [];
          const now = Date.now();
          for (let i = 0; i < days; i++) {
            const dayStart = startOfDay(now + i * 86_400_000);
            const dayEnd = dayStart + 86_400_000;
            const count = Object.values(wordProgress).filter((p) => {
              if (p.status !== 'learning' || p.nextReviewAt <= 0) return false;
              return p.nextReviewAt >= dayStart && p.nextReviewAt < dayEnd;
            }).length;
            result.push({ date: new Date(dayStart), count });
          }
          return result;
        },
      };
    },
    {
      name: 'hanamado-word-learning',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        wordProgress: state.wordProgress,
        batches: state.batches,
        settings: state.settings,
      }),
    }
  )
);
