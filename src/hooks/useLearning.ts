import { useCallback, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useVocabStore } from '@/store/vocabStore';
import { useLearningStore } from '@/store/learningStore';
import type { AiReviewQuiz, LearningSettings, VocabLevel } from '@/types';
import {
  getCandidateWordIds,
  pickNewBatchFromFavorites,
  pickNewBatchWordIds,
} from '@/services/learningService';
import {
  generateNewWordPractice,
  generateReviewPractice,
} from '@/services/quizService';
import { loadLevel } from '@/services/vocabService';
import type { ReviewAnswerRecord } from '@/store/learningStore';

/**
 * 背单词学习与复习的高级 Hook。
 * 封装 store + service + AI 调用，供 UI 组件使用。
 */
export function useLearning() {
  const apiConfig = useChatStore((s) => s.apiConfig);
  const favoriteIds = useVocabStore((s) => s.favoriteIds);

  const store = useLearningStore;

  // ====== 状态订阅（按字段订阅避免无谓重渲染） ======
  const settings = store((s) => s.settings);
  const wordProgress = store((s) => s.wordProgress);
  const batches = store((s) => s.batches);

  const isLearningActive = store((s) => s.isLearningActive);
  const learningPhase = store((s) => s.learningPhase);
  const currentBatchWordIds = store((s) => s.currentBatchWordIds);
  const currentLearningIndex = store((s) => s.currentLearningIndex);
  const currentPracticeQueue = store((s) => s.currentPracticeQueue);
  const currentPracticeIndex = store((s) => s.currentPracticeIndex);
  const practiceWordId = store((s) => s.practiceWordId);
  const practiceWrongCount = store((s) => s.practiceWrongCount);

  // 批次后台预出题
  const batchPracticeQuizzes = store((s) => s.batchPracticeQuizzes);
  const isBatchQuizLoading = store((s) => s.isBatchQuizLoading);
  const batchQuizLoadedCount = store((s) => s.batchQuizLoadedCount);
  const batchQuizError = store((s) => s.batchQuizError);

  const isReviewActive = store((s) => s.isReviewActive);
  const currentReviewQueue = store((s) => s.currentReviewQueue);
  const currentReviewIndex = store((s) => s.currentReviewIndex);
  const currentQuiz = store((s) => s.currentQuiz);
  const isQuizLoading = store((s) => s.isQuizLoading);
  const reviewAnswers = store((s) => s.reviewAnswers);
  const lastResult = store((s) => s.lastResult);

  // ====== Actions ======
  const setSettings = store((s) => s.setSettings);
  const startNewBatch = store((s) => s.startNewBatch);
  const setLearningPhase = store((s) => s.setLearningPhase);
  const nextLearningCard = store((s) => s.nextLearningCard);
  const startPracticeForWord = store((s) => s.startPracticeForWord);
  const requeueCurrentPracticeQuestion = store((s) => s.requeueCurrentPracticeQuestion);
  const advancePracticeQuestion = store((s) => s.advancePracticeQuestion);
  const completeBatch = store((s) => s.completeBatch);
  const exitLearning = store((s) => s.exitLearning);

  const startBatchQuizGeneration = store((s) => s.startBatchQuizGeneration);
  const setBatchQuizLoaded = store((s) => s.setBatchQuizLoaded);
  const setBatchQuizError = store((s) => s.setBatchQuizError);
  const startBatchPractice = store((s) => s.startBatchPractice);

  const startReview = store((s) => s.startReview);
  const setCurrentQuiz = store((s) => s.setCurrentQuiz);
  const setQuizLoading = store((s) => s.setQuizLoading);
  const recordReviewAnswer = store((s) => s.recordReviewAnswer);
  const finishReviewWord = store((s) => s.finishReviewWord);
  const exitReview = store((s) => s.exitReview);
  const clearLastResult = store((s) => s.clearLastResult);

  const getTodayDueReviews = store((s) => s.getTodayDueReviews);
  const getTodayNewWordCount = store((s) => s.getTodayNewWordCount);
  const getMasteredCount = store((s) => s.getMasteredCount);
  const getStageDistribution = store((s) => s.getStageDistribution);
  const getFutureReviewSchedule = store((s) => s.getFutureReviewSchedule);

  // 用于取消上一批次的后台出题
  const batchQuizAbortRef = useRef<AbortController | null>(null);

  // ====== 高级操作 ======

  /** 开始一批新词学习：从词源抽取词 → 进入学习态，并在后台开始预出题 */
  const beginNewBatch = useCallback(
    async (overrideSettings?: Partial<LearningSettings>): Promise<{ ok: boolean; reason?: string }> => {
      const effectiveSettings: LearningSettings = { ...settings, ...overrideSettings };
      const excludeIds = new Set(Object.keys(wordProgress));

      // JLPT 词源需要先确保词库已加载，加 30s 超时防止网络挂起导致按钮永久 loading
      if (effectiveSettings.source === 'jlpt') {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort('timeout'), 30_000);
        try {
          await loadLevel(effectiveSettings.selectedLevel, controller.signal);
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') {
            return { ok: false, reason: `加载 ${effectiveSettings.selectedLevel} 词库超时，请检查网络后重试` };
          }
          return {
            ok: false,
            reason: `加载 ${effectiveSettings.selectedLevel} 词库失败：${e instanceof Error ? e.message : '未知错误'}`,
          };
        } finally {
          clearTimeout(timer);
        }
      }

      let wordIds: string[];
      if (effectiveSettings.source === 'favorite') {
        wordIds = pickNewBatchFromFavorites(favoriteIds, excludeIds, effectiveSettings.batchSize);
      } else {
        wordIds = pickNewBatchWordIds(effectiveSettings, excludeIds);
      }

      if (wordIds.length === 0) {
        return { ok: false, reason: '当前词源暂无可学新词' };
      }

      startNewBatch(wordIds);

      // 在后台预生成整批次的练习题，减少用户记词结束后的等待
      if (apiConfig) {
        prepareBatchQuizzes(wordIds);
      }

      return { ok: true };
    },
    [settings, wordProgress, favoriteIds, startNewBatch, apiConfig]
  );

  /** 后台预生成整批次的练习题 */
  const prepareBatchQuizzes = useCallback(
    async (wordIds: string[]) => {
      if (!apiConfig) return;

      // 取消上一批次的预出题
      if (batchQuizAbortRef.current) {
        batchQuizAbortRef.current.abort('new-batch');
      }
      const controller = new AbortController();
      batchQuizAbortRef.current = controller;

      startBatchQuizGeneration(wordIds);

      const results = await Promise.allSettled(
        wordIds.map(async (wordId) => {
          const quiz = await generateNewWordPractice(apiConfig, wordId, controller.signal);
          return { wordId, quiz } as { wordId: string; quiz: AiReviewQuiz };
        })
      );

      // 如果已经被取消（例如用户退出学习），不再更新状态
      if (controller.signal.aborted) return;

      let hasError = false;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          setBatchQuizLoaded(result.value.wordId, result.value.quiz);
        } else {
          hasError = true;
        }
      }

      if (hasError) {
        setBatchQuizError('部分题目生成失败，可重试或继续学习');
      }
    },
    [apiConfig, startBatchQuizGeneration, setBatchQuizLoaded, setBatchQuizError]
  );

  /**
   * 为当前词加载即时练习题并切换到 quiz 阶段。
   * 调用方拿到 error 时可重试一次。
   * 可传入 AbortSignal 以支持取消/超时。
   */
  const beginPracticeForCurrentWord = useCallback(
    async (signal?: AbortSignal): Promise<{ ok: boolean; error?: string; aborted?: boolean }> => {
      if (!apiConfig) return { ok: false, error: '请先在设置中配置 API' };
      const wordId = currentBatchWordIds[currentLearningIndex];
      if (!wordId) return { ok: false, error: '无效的词' };

      try {
        const quiz: AiReviewQuiz = await generateNewWordPractice(apiConfig, wordId, signal);
        startPracticeForWord(wordId, quiz);
        return { ok: true };
      } catch (e) {
        // 主动取消：返回 aborted 标记，调用方不应把它当错误展示
        if (e instanceof DOMException && e.name === 'AbortError') {
          return { ok: false, aborted: true };
        }
        return {
          ok: false,
          error: e instanceof Error ? e.message : '生成练习题失败',
        };
      }
    },
    [apiConfig, currentBatchWordIds, currentLearningIndex, startPracticeForWord]
  );

  /**
   * 判断当前选择是否正确。
   * 不再此处修改队列状态：提交后由 UI 展示结果，用户点击「下一题」后再 advance/requeue。
   */
  const submitPracticeAnswer = useCallback(
    (selectedOption: number): { correct: boolean } => {
      const question = currentPracticeQueue[currentPracticeIndex];
      if (!question) return { correct: false };
      return { correct: selectedOption === question.answer };
    },
    [currentPracticeQueue, currentPracticeIndex]
  );

  /** 完成整个批次学习 */
  const finishBatch = useCallback(() => {
    completeBatch();
  }, [completeBatch]);

  /** 开始到期复习：取今日到期 → 进入复习态 → 加载第一个 quiz */
  const beginReview = useCallback(
    async (): Promise<{ ok: boolean; reason?: string }> => {
      const dueIds = getTodayDueReviews();
      if (dueIds.length === 0) {
        return { ok: false, reason: '今日没有到期的复习任务' };
      }
      if (!apiConfig) {
        return { ok: false, reason: '请先在设置中配置 API' };
      }

      startReview(dueIds);

      // 预加载第一个词的题目，加 45s 超时避免 AI 无响应时永久 loading
      setQuizLoading(true);
      const firstWordId = dueIds[0];
      const progress = wordProgress[firstWordId];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort('timeout'), 45_000);
      try {
        const quiz = await generateReviewPractice(apiConfig, firstWordId, progress?.currentStage ?? 0, controller.signal);
        setCurrentQuiz(quiz);
      } catch (e) {
        setCurrentQuiz(null);
        if (e instanceof DOMException && e.name === 'AbortError') {
          console.warn('[Review] First quiz timed out');
        } else {
          console.warn('[Review] Failed to load first quiz:', e);
        }
      } finally {
        clearTimeout(timer);
        setQuizLoading(false);
      }
      return { ok: true };
    },
    [apiConfig, wordProgress, getTodayDueReviews, startReview, setQuizLoading, setCurrentQuiz]
  );

  /** 由 UI 调用：记录单题作答结果 */
  const recordAnswer = useCallback(
    (record: ReviewAnswerRecord) => {
      recordReviewAnswer(record);
    },
    [recordReviewAnswer]
  );

  /**
   * 完成当前词的复习，根据该词本次正确数推进进度，并加载下一个词的 quiz。
   * @returns finished=true 表示整个复习队列已结束
   */
  const finishCurrentReviewWord = useCallback(
    async (): Promise<{ finished: boolean; error?: string }> => {
      const wordId = currentReviewQueue[currentReviewIndex];
      if (!wordId) return { finished: true };

      // 统计本次该词的作答对错
      // 同一个词在一次复习中作答的所有题均计入该词
      const wordAnswers = reviewAnswers.filter((a) => a.wordId === wordId);
      const correct = wordAnswers.filter((a) => a.correct).length;
      const total = wordAnswers.length;

      if (total > 0) {
        finishReviewWord(correct, total);
      }

      // 进入下一个词
      const nextIndex = currentReviewIndex + 1;
      if (nextIndex >= currentReviewQueue.length) {
        exitReview(true);
        return { finished: true };
      }

      // 加载下一个 quiz
      // 先更新 index：通过调用 startReview 重新进入会重置，所以单独维护一个 setIndex 路径
      // 这里采用：直接在 store 上 next，但 store 没有 nextReviewWord，所以临时用 setCurrentQuiz null + 重新 startReview 的方式不合适
      // 改为：通过 useLearningStore.setState 直接更新 index
      useLearningStore.setState({
        currentReviewIndex: nextIndex,
        currentQuiz: null,
      });

      if (!apiConfig) return { finished: false, error: 'API 配置缺失' };
      const nextWordId = currentReviewQueue[nextIndex];
      const nextProgress = useLearningStore.getState().wordProgress[nextWordId];
      setQuizLoading(true);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort('timeout'), 45_000);
      try {
        const quiz = await generateReviewPractice(apiConfig, nextWordId, nextProgress?.currentStage ?? 0, controller.signal);
        setCurrentQuiz(quiz);
        return { finished: false };
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          return { finished: false, error: 'AI 响应超时，请检查网络或 API 后重试' };
        }
        return {
          finished: false,
          error: e instanceof Error ? e.message : '加载下一题失败',
        };
      } finally {
        clearTimeout(timer);
        setQuizLoading(false);
      }
    },
    [
      apiConfig,
      currentReviewIndex,
      currentReviewQueue,
      reviewAnswers,
      finishReviewWord,
      exitReview,
      setQuizLoading,
      setCurrentQuiz,
    ]
  );

  /** 跳过当前复习词（不计入对错，进入下一个） */
  const skipCurrentReviewWord = useCallback(async () => {
    const nextIndex = currentReviewIndex + 1;
    if (nextIndex >= currentReviewQueue.length) {
      exitReview(true);
      return { finished: true };
    }
    useLearningStore.setState({
      currentReviewIndex: nextIndex,
      currentQuiz: null,
    });
    if (!apiConfig) return { finished: false };
    const nextWordId = currentReviewQueue[nextIndex];
    const nextProgress = useLearningStore.getState().wordProgress[nextWordId];
    setQuizLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 45_000);
    try {
      const quiz = await generateReviewPractice(apiConfig, nextWordId, nextProgress?.currentStage ?? 0, controller.signal);
      setCurrentQuiz(quiz);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        console.warn('[Review] skip load timed out');
      } else {
        console.warn('[Review] skip load failed:', e);
      }
    } finally {
      clearTimeout(timer);
      setQuizLoading(false);
    }
    return { finished: false };
  }, [apiConfig, currentReviewIndex, currentReviewQueue, exitReview, setQuizLoading, setCurrentQuiz]);

  return {
    // settings & progress
    settings,
    wordProgress,
    batches,
    setSettings,
    getCandidateWordIdsCount: (): number => {
      if (settings.source === 'favorite') return favoriteIds.length;
      return getCandidateWordIds(settings).length;
    },

    // learning state
    isLearningActive,
    learningPhase,
    currentBatchWordIds,
    currentLearningIndex,
    currentPracticeQueue,
    currentPracticeIndex,
    practiceWordId,
    practiceWrongCount,
    batchPracticeQuizzes,
    isBatchQuizLoading,
    batchQuizLoadedCount,
    batchQuizError,
    beginNewBatch,
    setLearningPhase,
    nextLearningCard,
    startBatchPractice,
    beginPracticeForCurrentWord,
    submitPracticeAnswer,
    advancePracticeQuestion,
    requeueCurrentPracticeQuestion,
    finishBatch,
    exitLearning,

    // review state
    isReviewActive,
    currentReviewQueue,
    currentReviewIndex,
    currentQuiz,
    isQuizLoading,
    reviewAnswers,
    beginReview,
    recordAnswer,
    finishCurrentReviewWord,
    skipCurrentReviewWord,
    exitReview,

    // result
    lastResult,
    clearLastResult,

    // getters
    getTodayDueReviews,
    getTodayNewWordCount,
    getMasteredCount,
    getStageDistribution,
    getFutureReviewSchedule,

    hasApi: !!apiConfig,
  };
}
