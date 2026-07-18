import { useState, useEffect, useCallback } from 'react';
import GameIcon from '@/components/common/GameIcon';
import Loading from '@/components/common/Loading';
import { useLearning } from '@/hooks/useLearning';
import { getEntryById } from '@/services/vocabService';
import { getAiEntry } from '@/services/aiWordStorage';
import type { ReviewAnswerRecord } from '@/store/learningStore';

/** 获取词的显示文本 */
function getWordText(wordId: string): string {
  if (wordId.startsWith('ai:')) {
    return getAiEntry(wordId.slice(3))?.dictionary_form ?? wordId;
  }
  return getEntryById(wordId)?.kanji ?? wordId;
}

export default function ReviewRunner() {
  const {
    currentReviewQueue,
    currentReviewIndex,
    currentQuiz,
    isQuizLoading,
    recordAnswer,
    finishCurrentReviewWord,
    skipCurrentReviewWord,
    exitReview,
  } = useLearning();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const wordId = currentReviewQueue[currentReviewIndex];
  const totalWords = currentReviewQueue.length;
  const currentQuestion = currentQuiz?.questions[currentQuestionIndex];

  // 切换到新词时重置 UI
  useEffect(() => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setShowAnswer(false);
    setError(null);
  }, [currentReviewIndex]);

  // 切换到下一题时重置
  useEffect(() => {
    setSelectedOption(null);
    setShowAnswer(false);
  }, [currentQuestionIndex]);

  // 出题 loading 期间递增已等待秒数
  useEffect(() => {
    if (!isQuizLoading || currentQuiz) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [isQuizLoading, currentQuiz]);

  const handleSubmitAnswer = useCallback(() => {
    if (!currentQuiz || selectedOption === null || !currentQuestion) return;

    const correct = selectedOption === currentQuestion.answer;
    const record: ReviewAnswerRecord = {
      wordId: wordId,
      questionIndex: currentQuestionIndex,
      question: currentQuestion,
      selected: selectedOption,
      correct,
    };
    recordAnswer(record);
    setShowAnswer(true);
  }, [currentQuiz, selectedOption, currentQuestion, wordId, currentQuestionIndex, recordAnswer, currentQuestion]);

  const handleNext = useCallback(async () => {
    if (!currentQuiz) return;

    // 是否当前词最后一题
    const isLastQuestion = currentQuestionIndex >= currentQuiz.questions.length - 1;

    if (!isLastQuestion) {
      setCurrentQuestionIndex((i) => i + 1);
      return;
    }

    // 当前词所有题已答完；完成后右侧栏会自动展示结果，本组件随即卸载
    const result = await finishCurrentReviewWord();
    if (result.error) {
      setError(result.error);
    }
  }, [currentQuiz, currentQuestionIndex, finishCurrentReviewWord]);

  const handleSkip = useCallback(async () => {
    await skipCurrentReviewWord();
  }, [skipCurrentReviewWord]);

  // ====== Loading ======
  if (isQuizLoading && !currentQuiz) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <Loading variant="spinner" />
        <div className="text-center space-y-1">
          <p className="text-xs text-apple-text-secondary">AI 正在生成本次复习题目...</p>
          <p className="text-[11px] text-apple-text-secondary">
            已等待 {elapsed}s {elapsed >= 20 && '· 网络较慢，可取消重试'}
          </p>
        </div>
        <div className="w-full max-w-xs h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full bg-apple-blue rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${Math.min(100, (elapsed / 45) * 100)}%` }}
          />
        </div>
        <button
          onClick={() => exitReview(false)}
          className="px-4 py-1.5 rounded-xl text-xs font-medium text-apple-text-secondary
            hover:text-apple-text bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08]
            dark:hover:bg-white/[0.1] transition-colors"
        >
          取消
        </button>
      </div>
    );
  }

  // ====== Error ======
  if (error || !currentQuiz || !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <GameIcon name="warning" className="w-8 h-8 text-amber-500" />
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
          {error || '加载题目失败'}
        </p>
        <button
          onClick={handleSkip}
          className="px-4 py-2 rounded-xl bg-apple-blue text-white text-xs font-medium"
        >
          跳过当前词
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-apple-text-secondary">
          复习进度: {currentReviewIndex + 1} / {totalWords}
        </span>
        <button
          onClick={() => exitReview(false)}
          className="flex items-center gap-1 text-xs text-apple-text-secondary hover:text-apple-text transition-colors"
        >
          <GameIcon name="cross" className="w-3.5 h-3.5" />
          退出
        </button>
      </div>

      {/* Word progress bar */}
      <div className="h-1 bg-black/[0.05] dark:bg-white/[0.05] rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-apple-blue transition-all duration-300"
          style={{
            width: `${((currentReviewIndex + (currentQuestionIndex + 1) / currentQuiz.questions.length) / totalWords) * 100}%`,
          }}
        />
      </div>

      {/* Word info */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-apple-text-secondary">复习词:</span>
        <span className="text-sm font-medium">{getWordText(wordId)}</span>
        <span className="text-xs text-apple-text-secondary ml-auto">
          第 {currentQuestionIndex + 1} / {currentQuiz.questions.length} 题
        </span>
      </div>

      {/* Question */}
      <div className="glass-card rounded-2xl p-4 flex-1 flex flex-col">
        <h4 className="text-sm font-medium mb-3">{currentQuestion.prompt}</h4>
        <p className="text-2xl text-center my-4 font-medium">{currentQuestion.stem}</p>

        {/* Options */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          {currentQuestion.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentQuestion.answer;
            let stateClass = 'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]';

            if (showAnswer) {
              if (isCorrect) {
                stateClass = 'bg-emerald-500 text-white';
              } else if (isSelected) {
                stateClass = 'bg-red-500 text-white';
              } else {
                stateClass = 'bg-black/[0.03] dark:bg-white/[0.05] opacity-50';
              }
            } else if (isSelected) {
              stateClass = 'bg-apple-blue text-white';
            }

            return (
              <button
                key={idx}
                onClick={() => !showAnswer && setSelectedOption(idx)}
                disabled={showAnswer}
                className={`py-3 px-3 rounded-xl text-sm font-medium transition-all ${stateClass}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showAnswer && (
          <div className="mt-3 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] text-xs">
            <p className="text-apple-text-secondary">{currentQuestion.explanation}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSkip}
          className="px-4 py-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] text-xs text-apple-text-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
        >
          跳过
        </button>
        {!showAnswer ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedOption === null}
            className="flex-1 py-3 rounded-xl bg-apple-blue text-white text-sm font-medium
              disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            提交答案
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl bg-apple-blue text-white text-sm font-medium
              hover:opacity-90 transition-opacity"
          >
            {currentQuestionIndex >= (currentQuiz.questions.length - 1) ? '完成该词' : '下一题'}
          </button>
        )}
      </div>
    </div>
  );
}


