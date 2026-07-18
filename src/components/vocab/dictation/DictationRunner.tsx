import { useCallback, useEffect, useState } from 'react';
import GameIcon from '@/components/common/GameIcon';
import Loading from '@/components/common/Loading';
import TypingPanel from './TypingPanel';
import { useDictation } from '@/hooks/useDictation';

/**
 * 听写主流程组件：
 * - 顶部展示中文翻译 + 音频按钮（进入新词时自动播放一次）
 * - 中间渲染 TypingPanel（键入模式，支持 IME 输入）
 * - 提交后显示对错反馈与正确答案
 * - 全部完成后显示本次听写汇总
 */
export default function DictationRunner() {
  const {
    settings,
    currentWordView,
    totalWords,
    progressIndex,
    isLastWord,
    results,
    playCurrentAudio,
    submitTyping,
    advanceToNextWord,
    exitDictation,
    finishDictation,
  } = useDictation();

  const [submitted, setSubmitted] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // 进入新词时重置 UI
  useEffect(() => {
    setSubmitted(false);
    setLastCorrect(null);
  }, [progressIndex, currentWordView?.wordId]);

  // 自动播放音频（进入新词时）
  useEffect(() => {
    if (!settings.autoPlayAudio || !currentWordView || submitted) return;
    let cancelled = false;
    setIsPlayingAudio(true);
    playCurrentAudio().finally(() => {
      if (!cancelled) setIsPlayingAudio(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressIndex, currentWordView?.wordId]);

  // ====== Handlers ======

  const handlePlayAudio = useCallback(() => {
    if (!currentWordView || isPlayingAudio) return;
    setIsPlayingAudio(true);
    playCurrentAudio().finally(() => setIsPlayingAudio(false));
  }, [currentWordView, isPlayingAudio, playCurrentAudio]);

  const handleSubmitTyping = useCallback(
    (input: string) => {
      const result = submitTyping(input);
      setLastCorrect(result.correct);
      setSubmitted(true);
      return result;
    },
    [submitTyping]
  );

  const handleNext = useCallback(() => {
    if (isLastWord) {
      setShowSummary(true);
    } else {
      advanceToNextWord();
    }
  }, [isLastWord, advanceToNextWord]);

  const handleFinish = useCallback(() => {
    finishDictation();
  }, [finishDictation]);

  // ====== Summary 视图 ======
  if (showSummary) {
    return <DictationSummaryView results={results} totalWords={totalWords} onFinish={handleFinish} />;
  }

  // ====== Loading 视图（词条解析中） ======
  if (!currentWordView) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loading variant="spinner" />
        <p className="text-xs text-apple-text-secondary">正在加载词条...</p>
      </div>
    );
  }

  const correctCount = results.filter((r) => r.correct).length;

  return (
    <div className="flex flex-col h-full">
      {/* 进度条 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-apple-text-secondary">
          听写进度：<span className="font-medium text-apple-text dark:text-white">{progressIndex + 1}</span> / {totalWords}
          <span className="ml-2 text-apple-text-secondary/70">
            （已对 {correctCount} 词）
          </span>
        </span>
        <button
          onClick={exitDictation}
          className="flex items-center gap-1 text-xs text-apple-text-secondary
            hover:text-apple-text dark:hover:text-white transition-colors"
        >
          <GameIcon name="cross" className="w-3.5 h-3.5" />
          退出
        </button>
      </div>
      <div className="h-1 bg-black/[0.05] dark:bg-white/[0.05] rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-apple-blue transition-all duration-300"
          style={{ width: `${((progressIndex + (submitted ? 1 : 0)) / totalWords) * 100}%` }}
        />
      </div>

      {/* 顶部：中文翻译 + 播放按钮 */}
      <div className="glass-card rounded-xl p-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <GameIcon name="translate" className="w-3.5 h-3.5 text-apple-text-secondary" />
              <span className="text-[11px] uppercase tracking-wider text-apple-text-secondary">
                中文翻译
              </span>
              {currentWordView.pos && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] text-apple-text-secondary">
                  {currentWordView.pos}
                </span>
              )}
            </div>
            <p className="text-base font-medium text-apple-text dark:text-white leading-snug">
              {currentWordView.meaning || '（无翻译）'}
            </p>
          </div>
          <button
            onClick={handlePlayAudio}
            disabled={isPlayingAudio}
            title="播放音频"
            className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full
              bg-apple-blue/10 dark:bg-apple-blue/20 text-apple-blue
              hover:bg-apple-blue/20 dark:hover:bg-apple-blue/30 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPlayingAudio ? (
              <Loading variant="spinner" />
            ) : (
              <GameIcon name="volume" className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* 中间：输入面板 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <TypingPanel
          expectedLength={currentWordView.expected.length}
          onSubmit={handleSubmitTyping}
          disabled={submitted}
        />
      </div>

      {/* 提交后反馈 */}
      {submitted && (
        <div className="mt-2 animate-fade-in">
          <div
            className={`rounded-xl p-2.5 flex items-start gap-2
              ${lastCorrect
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
              }`}
          >
            <div className={`flex-shrink-0 mt-0.5 ${lastCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
              <GameIcon name={lastCorrect ? 'tick' : 'cross'} className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {lastCorrect ? '正确' : '不正确'}
              </p>
              {!lastCorrect && (
                <p className="text-xs mt-0.5 opacity-90">
                  正确答案：
                  <span className="font-semibold tracking-wide">
                    {currentWordView.expected}
                  </span>
                  <span className="ml-2 opacity-75">
                    （{currentWordView.kana}）
                  </span>
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleNext}
            className="mt-2 w-full py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium
              shadow-sm hover:opacity-90 transition-opacity"
          >
            {isLastWord ? '查看本次听写结果' : '下一个词'}
            <span className="ml-1.5 opacity-80">→</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ====== 汇总视图 ======

interface SummaryProps {
  results: { correct: boolean; expected: string; actual: string; source: 'jlpt' | 'ai' }[];
  totalWords: number;
  onFinish: () => void;
}

function DictationSummaryView({ results, totalWords, onFinish }: SummaryProps) {
  const correctCount = results.filter((r) => r.correct).length;
  const accuracy = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;
  const wrongResults = results.filter((r) => !r.correct);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-apple-text-secondary">本次听写已完成</span>
        <span className="text-xs text-apple-text-secondary">{totalWords} 词</span>
      </div>

      {/* 总分卡片 */}
      <div className="glass-card rounded-2xl p-5 mb-4 text-center">
        <div className="text-4xl font-bold text-apple-blue mb-1">{accuracy}%</div>
        <div className="text-sm text-apple-text-secondary">
          正确 <span className="font-medium text-emerald-500">{correctCount}</span> / {totalWords}
        </div>
      </div>

      {/* 错题列表 */}
      {wrongResults.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-y-auto glass-card rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-apple-text-secondary uppercase tracking-wide mb-2">
            错题回顾（{wrongResults.length}）
          </h3>
          <ul className="space-y-1.5">
            {wrongResults.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm px-3 py-2 rounded-lg
                  bg-rose-500/[0.06] dark:bg-rose-500/[0.1]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-rose-500 text-xs">✗</span>
                  <span className="font-medium">{r.expected}</span>
                </div>
                <div className="text-xs text-apple-text-secondary">
                  你写：<span className="text-apple-text dark:text-white">{r.actual || '（空）'}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <GameIcon name="star" className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-medium">全部正确！</p>
            <p className="text-xs text-apple-text-secondary mt-1">太棒了</p>
          </div>
        </div>
      )}

      <button
        onClick={onFinish}
        className="mt-4 w-full py-3 rounded-xl bg-apple-blue text-white text-sm font-medium
          shadow-sm hover:opacity-90 transition-opacity"
      >
        完成
      </button>
    </div>
  );
}
