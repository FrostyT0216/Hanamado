import { useCallback, useEffect, useState } from 'react';
import { useDictationStore } from '@/store/dictationStore';
import {
  pickDictationCandidates,
  resolveDictationWord,
  ensureWordsResolvable,
  checkDictationInput,
  type DictationWordView,
} from '@/services/dictationService';
import type { DictationResultRecord, DictationSource } from '@/types';

/**
 * 听写会话高级 Hook。
 * 封装 store 逻辑，供 UI 组件使用。
 * 仅支持键入模式（推荐配合系统手写输入法使用以获得最佳体验）。
 */
export function useDictation() {
  const store = useDictationStore;

  // ====== 状态订阅 ======
  const settings = store((s) => s.settings);
  const isDictationActive = store((s) => s.isDictationActive);
  const currentQueue = store((s) => s.currentQueue);
  const currentIndex = store((s) => s.currentIndex);
  const results = store((s) => s.results);
  const lastSummary = store((s) => s.lastSummary);

  // ====== Actions ======
  const setSettings = store((s) => s.setSettings);
  const startSession = store((s) => s.startSession);
  const recordResult = store((s) => s.recordResult);
  const nextWord = store((s) => s.nextWord);
  const exitSession = store((s) => s.exitSession);
  const clearLastSummary = store((s) => s.clearLastSummary);

  // ====== 本地状态 ======
  const [currentWordView, setCurrentWordView] = useState<DictationWordView | null>(null);

  // ====== 当前词解析 ======
  const currentWordId = currentQueue[currentIndex] ?? null;

  // 切换词时重新解析当前词
  useEffect(() => {
    if (!isDictationActive || !currentWordId) {
      setCurrentWordView(null);
      return;
    }
    const view = resolveDictationWord(currentWordId);
    setCurrentWordView(view);
  }, [isDictationActive, currentWordId]);

  // ====== 高级操作 ======

  /**
   * 开始一次听写会话
   * @param override 可覆盖 source/batchSize
   * @param explicitWordIds 显式指定听写的 wordIds（用于手动选择单词场景）
   * @returns ok=true 表示成功启动；ok=false 时 reason 描述原因
   */
  const beginDictation = useCallback(
    async (
      override?: Partial<{ source: DictationSource; batchSize: number }>,
      explicitWordIds?: string[]
    ): Promise<{ ok: boolean; reason?: string }> => {
      const effectiveSource = override?.source ?? settings.source;
      const effectiveBatchSize = override?.batchSize ?? settings.batchSize;

      // 确定 wordIds：显式传入优先，否则从词源随机抽取
      let wordIds: string[];
      if (explicitWordIds && explicitWordIds.length > 0) {
        wordIds = explicitWordIds;
      } else {
        wordIds = pickDictationCandidates(effectiveSource, effectiveBatchSize);
      }

      if (wordIds.length === 0) {
        return {
          ok: false,
          reason:
            effectiveSource === 'learning'
              ? '当前没有"学习中"的单词，请先学习新词'
              : effectiveSource === 'mastered'
              ? '当前没有"已掌握"的单词'
              : '当前没有自定义列表单词（请先收藏或保存到 AI 收录）',
        };
      }

      // 预加载所需 level 数据，确保所有 wordId 都能解析
      await ensureWordsResolvable(wordIds);

      // 过滤掉仍无法解析的 wordId
      const validIds = wordIds.filter((id) => resolveDictationWord(id) !== null);
      if (validIds.length === 0) {
        return { ok: false, reason: '所选词源中的单词无法解析，请尝试其他词源' };
      }

      startSession(validIds);
      return { ok: true };
    },
    [settings, startSession]
  );

  /** 播放当前词的音频 */
  const playCurrentAudio = useCallback(
    async (rate?: number): Promise<void> => {
      if (!currentWordView) return;
      const { speakJapanese } = await import('@/services/speechService');
      await speakJapanese(currentWordView.kana, { rate });
    },
    [currentWordView]
  );

  /**
   * 提交键入答案
   * 支持汉字/假名混合输入：只要没有拼错就算对
   */
  const submitTyping = useCallback(
    (input: string): { correct: boolean; expected: string } => {
      if (!currentWordView) return { correct: false, expected: '' };
      const expected = currentWordView.expected;
      const kana = currentWordView.kana;
      const trimmed = input.trim();
      const correct = checkDictationInput(trimmed, expected, kana);

      const record: DictationResultRecord = {
        wordId: currentWordView.wordId,
        source: currentWordView.source,
        expected,
        actual: trimmed,
        correct,
        durationMs: 0,
      };
      recordResult(record);
      return { correct, expected };
    },
    [currentWordView, recordResult]
  );

  /** 进入下一个词；若已是末尾，则结束会话 */
  const advanceToNextWord = useCallback((): { finished: boolean } => {
    if (currentIndex >= currentQueue.length - 1) {
      exitSession(true);
      return { finished: true };
    }
    nextWord();
    return { finished: false };
  }, [currentIndex, currentQueue.length, nextWord, exitSession]);

  /** 退出会话（不视为完成） */
  const exitDictation = useCallback(() => {
    exitSession(false);
  }, [exitSession]);

  /** 完成会话（视为完成，生成 summary） */
  const finishDictation = useCallback(() => {
    exitSession(true);
  }, [exitSession]);

  return {
    // settings
    settings,
    setSettings,

    // session state
    isDictationActive,
    currentQueue,
    currentIndex,
    currentWordId,
    currentWordView,
    results,
    lastSummary,

    // session operations
    beginDictation,
    playCurrentAudio,
    submitTyping,
    advanceToNextWord,
    exitDictation,
    finishDictation,
    clearLastSummary,

    // progress
    totalWords: currentQueue.length,
    progressIndex: currentIndex,
    isLastWord: currentIndex >= currentQueue.length - 1,
  };
}
