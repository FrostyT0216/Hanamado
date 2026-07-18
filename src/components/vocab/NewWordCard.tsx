import { useEffect, useState, useCallback } from 'react';
import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import Loading from '@/components/common/Loading';
import { useLearning } from '@/hooks/useLearning';
import { getEntryById } from '@/services/vocabService';
import { getAiEntry } from '@/services/aiWordStorage';
import type { VocabEntry, LocalAiEntry } from '@/types';

interface DisplayWord {
  kanji: string;
  furigana: string;
  pitch: string;
  pos: string;
  definition: string;
  notes: string;
  sentences: { kanji: string; furigana: string; translation: string }[];
}

/** 将 stem 中的 _____ 或 （ ） 渲染为带下划线的主题色高亮 */
function renderStem(stem: string) {
  if (!stem.includes('_____') && !stem.includes('（ ）')) {
    return <span className="break-words">{stem}</span>;
  }
  const parts = stem.split(/(_____|（ ）)/);
  return (
    <span className="break-words">
      {parts.map((part, i) => {
        if (part === '_____' || part === '（ ）') {
          return (
            <span
              key={i}
              className="underline decoration-2 text-apple-blue"
              style={{ textUnderlineOffset: '4px' }}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function toDisplay(wordId: string): DisplayWord | null {
  if (wordId.startsWith('ai:')) {
    const word = wordId.slice(3);
    const entry: LocalAiEntry | null = getAiEntry(word);
    if (!entry) return null;
    return {
      kanji: entry.dictionary_form,
      furigana: entry.kana_form,
      pitch: entry.pitch,
      pos: entry.parts_of_speech.map((p) => p.term).join('、'),
      definition: entry.definition,
      notes: '',
      sentences: entry.example_sentences.map((s) => ({
        kanji: s.japanese,
        furigana: '',
        translation: s.chinese_translation,
      })),
    };
  }
  // 词库 ID 现在是 UUID，不再以 N[1-5]- 开头；直接用 id 反查
  const entry: VocabEntry | null = getEntryById(wordId);
  if (!entry) return null;
  return {
    kanji: entry.kanji,
    furigana: entry.furigana,
    pitch: entry.pitch,
    pos: entry.pos,
    definition: entry.definition,
    notes: entry.notes,
    sentences: entry.sentences,
  };
}

export default function NewWordCard() {
  const {
    currentBatchWordIds,
    currentLearningIndex,
    learningPhase,
    currentPracticeQueue,
    currentPracticeIndex,
    practiceWrongCount,
    setLearningPhase,
    nextLearningCard,
    startBatchPractice,
    submitPracticeAnswer,
    advancePracticeQuestion,
    requeueCurrentPracticeQuestion,
    finishBatch,
    exitLearning,
    isBatchQuizLoading,
    batchQuizLoadedCount,
    batchQuizError,
  } = useLearning();

  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean } | null>(null);

  const wordId = currentBatchWordIds[currentLearningIndex];
  const word = wordId ? toDisplay(wordId) : null;

  const isLastCard = currentLearningIndex >= currentBatchWordIds.length - 1;
  const totalCards = currentBatchWordIds.length;

  const cardProgress = totalCards > 0
    ? `${currentLearningIndex + 1} / ${totalCards}`
    : '';

  // 切换到新词或练习下一题时重置 UI
  useEffect(() => {
    setIsFlipped(false);
    setSelectedOption(null);
    setShowAnswer(false);
    setPracticeError(null);
    setAnswerResult(null);
  }, [currentLearningIndex, wordId, currentPracticeIndex, currentPracticeQueue]);

  const handleNextOrStartPractice = useCallback(() => {
    if (learningPhase !== 'card') return;
    if (isLastCard) {
      startBatchPractice();
    } else {
      nextLearningCard();
    }
  }, [learningPhase, isLastCard, startBatchPractice, nextLearningCard]);

  const handleRetryPractice = useCallback(() => {
    setPracticeError(null);
    setLearningPhase('card');
    // 回到最后一张卡片，让用户再次点击开始练习
  }, [setLearningPhase]);

  const currentQuestion = currentPracticeQueue[currentPracticeIndex];
  const isPracticeComplete = currentPracticeQueue.length === 0 && learningPhase === 'quiz';

  const handleSubmitAnswer = useCallback(() => {
    if (selectedOption === null || !currentQuestion) return;
    const result = submitPracticeAnswer(selectedOption);
    setAnswerResult(result);
    setShowAnswer(true);
  }, [selectedOption, submitPracticeAnswer, currentQuestion]);

  const handleNextQuestion = useCallback(() => {
    if (!answerResult || !currentQuestion) return;
    if (answerResult.correct) {
      advancePracticeQuestion();
    } else {
      requeueCurrentPracticeQuestion();
    }
    // advance/requeue 会触发 useEffect，由它统一重置 UI
  }, [answerResult, currentQuestion, advancePracticeQuestion, requeueCurrentPracticeQuestion]);

  // Loading state
  if (!word) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loading variant="dots" />
        <p className="text-xs text-apple-text-secondary mt-2">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-apple-text-secondary">
          {learningPhase === 'card' ? cardProgress : `练习第 ${currentPracticeIndex + 1} / ${currentPracticeQueue.length} 题`}
        </span>
        <button
          onClick={exitLearning}
          className="flex items-center gap-1 text-xs text-apple-text-secondary hover:text-apple-text transition-colors"
        >
          <GameIcon name="cross" className="w-3.5 h-3.5" />
          退出学习
        </button>
      </div>

      {/* Word card phase */}
      {learningPhase === 'card' && (
        <div className="flex-1 flex flex-col">
          <div
            className="flashcard flex-1 max-h-[60%] cursor-pointer"
            onClick={() => setIsFlipped((f) => !f)}
          >
            <div className={`flashcard-inner relative w-full h-full ${isFlipped ? 'flipped' : ''}`}>
              {/* Front */}
              <div className="flashcard-front absolute inset-0 glass-card rounded-2xl flex flex-col items-center justify-center p-6">
                <span className="text-4xl font-medium mb-3 text-center">
                  {word.kanji}
                </span>
                <span className="text-sm text-apple-text-secondary">
                  {word.furigana}
                </span>
                {word.pitch && (
                  <span className="text-xs text-apple-text-secondary mt-1">
                    声调：{word.pitch}
                  </span>
                )}
                {word.pos && (
                  <span className="mt-3 px-2 py-0.5 rounded-full text-[11px] font-medium bg-apple-blue/10 text-apple-blue">
                    {word.pos}
                  </span>
                )}
                <p className="text-[11px] text-apple-text-secondary mt-4">
                  点击卡片查看释义
                </p>
              </div>

              {/* Back */}
              <div className="flashcard-back absolute inset-0 glass-card rounded-2xl">
                <CustomScrollbar className="h-full p-6" viewportClassName="">
                  <h4 className="text-xs font-medium text-apple-text-secondary mb-1">
                    释义
                  </h4>
                  <p className="text-sm mb-4">{word.definition}</p>
                  {word.notes && (
                    <>
                      <h4 className="text-xs font-medium text-apple-text-secondary mb-1">
                        补充
                      </h4>
                      <p className="text-sm text-apple-text-secondary mb-4">
                        {word.notes}
                      </p>
                    </>
                  )}
                  {word.sentences.length > 0 && (
                    <>
                      <h4 className="text-xs font-medium text-apple-text-secondary mb-1">
                        例句
                      </h4>
                      {word.sentences.slice(0, 2).map((s, i) => (
                        <div
                          key={i}
                          className="mb-3 pb-3 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0"
                        >
                          <p className="text-sm">{s.kanji}</p>
                          {s.furigana && (
                            <p className="text-xs text-apple-text-secondary mt-0.5">
                              {s.furigana}
                            </p>
                          )}
                          {s.translation && (
                            <p className="text-xs text-apple-text-secondary mt-0.5">
                              {s.translation}
                            </p>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </CustomScrollbar>
              </div>
            </div>
          </div>

          {/* AI pre-generation progress */}
          {isBatchQuizLoading && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-apple-text-secondary">
                <span>AI 正在预生成题目...</span>
                <span>{batchQuizLoadedCount} / {totalCards}</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/[0.05] dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-apple-blue/60 rounded-full transition-all duration-500"
                  style={{ width: `${totalCards > 0 ? (batchQuizLoadedCount / totalCards) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          {batchQuizError && (
            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 text-center">
              {batchQuizError}
            </p>
          )}

          {/* Action button */}
          <div className="mt-4">
            <button
              onClick={handleNextOrStartPractice}
              disabled={isLastCard && batchQuizLoadedCount < totalCards}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-apple-blue text-white
                text-sm font-medium hover:opacity-90 transition-opacity
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <GameIcon name="tick" className="w-4 h-4" />
              {isLastCard
                ? (batchQuizLoadedCount < totalCards ? '题目准备中...' : '开始练习')
                : '下一个'}
            </button>
          </div>
        </div>
      )}

      {/* Practice phase */}
      {learningPhase === 'quiz' && (
        <div className="flex-1 flex flex-col">
          {isPracticeComplete ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <GameIcon name="tick" className="w-10 h-10 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">本组练习已完成</p>
                {practiceWrongCount > 0 && (
                  <p className="text-xs text-apple-text-secondary mt-1">
                    共重做错题 {practiceWrongCount} 次
                  </p>
                )}
              </div>
              <button
                onClick={finishBatch}
                className="px-6 py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                完成学习
              </button>
            </div>
          ) : practiceError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <GameIcon name="warning" className="w-8 h-8 text-amber-500" />
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                {practiceError}
              </p>
              <button
                onClick={handleRetryPractice}
                className="px-4 py-2 rounded-xl bg-apple-blue text-white text-xs font-medium"
              >
                重试
              </button>
            </div>
          ) : currentQuestion ? (
            <>
              {/* Question progress */}
              <div className="flex items-center justify-between mb-3 text-xs text-apple-text-secondary">
                <span>练习第 {currentPracticeIndex + 1} / {currentPracticeQueue.length} 题</span>
                {practiceWrongCount > 0 && (
                  <span className="text-amber-500">错题 {practiceWrongCount}</span>
                )}
              </div>

              {/* Question card */}
              <div className="glass-card rounded-2xl p-4 flex-1 flex flex-col">
                <h4 className="text-sm font-medium mb-3">{currentQuestion.prompt}</h4>
                <p className="text-2xl text-center my-4 font-medium leading-relaxed">
                  {renderStem(currentQuestion.stem)}
                </p>

                {/* Answer feedback */}
                {showAnswer && (
                  <div className={`text-center text-sm font-medium mb-3 ${
                    selectedOption === currentQuestion.answer
                      ? 'text-emerald-500'
                      : 'text-red-500'
                  }`}>
                    {selectedOption === currentQuestion.answer ? (
                      <span className="inline-flex items-center gap-1">
                        <GameIcon name="tick" className="w-4 h-4" />
                        回答正确
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <GameIcon name="cross" className="w-4 h-4" />
                        回答错误
                      </span>
                    )}
                  </div>
                )}

                {/* Options */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrect = idx === currentQuestion.answer;
                    let stateClass = 'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]';

                    if (showAnswer) {
                      if (isCorrect) {
                        stateClass = 'bg-emerald-500 text-white ring-2 ring-emerald-300';
                      } else if (isSelected) {
                        stateClass = 'bg-red-500 text-white ring-2 ring-red-300';
                      } else {
                        stateClass = 'bg-red-500/70 text-white';
                      }
                    } else if (isSelected) {
                      stateClass = 'bg-apple-blue text-white';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => !showAnswer && setSelectedOption(idx)}
                        disabled={showAnswer}
                        className={`relative py-3 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${stateClass}`}
                      >
                        {showAnswer && isCorrect && (
                          <GameIcon name="tick" className="w-4 h-4" />
                        )}
                        {showAnswer && !isCorrect && isSelected && (
                          <GameIcon name="cross" className="w-4 h-4" />
                        )}
                        <span className="break-words">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {showAnswer && selectedOption !== currentQuestion.answer && currentQuestion.explanation && (
                  <div className="mt-3 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] text-xs border-l-2 border-amber-400">
                    <p className="text-apple-text-secondary leading-relaxed">
                      <span className="font-medium text-amber-600 dark:text-amber-400">解析：</span>
                      {currentQuestion.explanation}
                    </p>
                  </div>
                )}
              </div>

              {/* Action button */}
              <div className="mt-4">
                {!showAnswer ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={selectedOption === null}
                    className="w-full py-3 rounded-xl bg-apple-blue text-white text-sm font-medium
                      disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    提交答案
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    className="w-full py-3 rounded-xl bg-apple-blue text-white text-sm font-medium
                      hover:opacity-90 transition-opacity"
                  >
                    {answerResult?.correct && currentPracticeIndex >= currentPracticeQueue.length - 1
                      ? '完成学习'
                      : '下一题'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loading variant="spinner" />
              <p className="text-xs text-apple-text-secondary">题目准备中...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
