import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import { useLearning } from '@/hooks/useLearning';
import { getEntryById } from '@/services/vocabService';
import { getAiEntry } from '@/services/aiWordStorage';
import type { ReviewAnswerRecord } from '@/store/learningStore';

function getWordText(wordId: string): string {
  if (wordId.startsWith('ai:')) {
    return getAiEntry(wordId.slice(3))?.dictionary_form ?? wordId;
  }
  return getEntryById(wordId)?.kanji ?? wordId;
}

export default function LearningResultView() {
  const { lastResult, clearLastResult } = useLearning();

  if (!lastResult) return null;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">
          {lastResult.type === 'new' ? '学习结果' : '复习结果'}
        </h3>
        <button
          onClick={clearLastResult}
          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          title="关闭"
        >
          <GameIcon name="cross" className="w-[18px] h-[18px]" />
        </button>
      </div>

      <CustomScrollbar className="flex-1" viewportClassName="">
        {lastResult.type === 'new' ? (
          <NewWordResult result={lastResult} onDone={clearLastResult} />
        ) : (
          <ReviewResult answers={lastResult.answers} onDone={clearLastResult} />
        )}
      </CustomScrollbar>
    </div>
  );
}

function NewWordResult({
  result,
  onDone,
}: {
  result: { wordCount: number; wrongCount: number };
  onDone: () => void;
}) {
  const allCorrect = result.wrongCount === 0;

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-6 text-center">
        <div
          className={`text-5xl font-bold ${
            allCorrect ? 'text-emerald-500' : 'text-amber-500'
          }`}
        >
          {allCorrect ? (
            <span className="inline-flex items-center justify-center">
              <GameIcon name="tick" className="w-12 h-12" />
            </span>
          ) : (
            `${result.wrongCount}`
          )}
        </div>
        <div className="text-xs text-apple-text-secondary mt-2">
          {allCorrect
            ? '全部答对，干得漂亮！'
            : `本组共重做错题 ${result.wrongCount} 次`}
        </div>
        <div className="text-[11px] text-apple-text-secondary mt-1">
          已学习 {result.wordCount} 个新词
        </div>
      </div>

      <button
        onClick={onDone}
        className="w-full py-3 rounded-xl bg-apple-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        完成
      </button>
    </div>
  );
}

function ReviewResult({
  answers,
  onDone,
}: {
  answers: ReviewAnswerRecord[];
  onDone: () => void;
}) {
  const correctCount = answers.filter((a) => a.correct).length;
  const totalCount = answers.length;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const wrongAnswers = answers.filter((a) => !a.correct);

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="glass-card rounded-2xl p-6 text-center">
        <div
          className={`text-5xl font-bold ${
            accuracy >= 80 ? 'text-emerald-500' : accuracy >= 60 ? 'text-amber-500' : 'text-red-500'
          }`}
        >
          {accuracy}%
        </div>
        <div className="text-xs text-apple-text-secondary mt-2">
          正确 {correctCount} / 共 {totalCount} 题
        </div>
      </div>

      {/* Wrong answers list */}
      {wrongAnswers.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-apple-text-secondary uppercase tracking-wide">
            错题列表 ({wrongAnswers.length})
          </h4>
          {wrongAnswers.map((a, i) => (
            <div key={i} className="glass-card rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-apple-blue/10 text-apple-blue">
                  {a.question.type}
                </span>
                <span className="text-sm font-medium">{getWordText(a.wordId)}</span>
              </div>
              <p className="text-xs text-apple-text-secondary">{a.question.prompt}</p>
              <p className="text-sm">{a.question.stem}</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="px-2 py-1.5 rounded bg-red-500/10 text-red-700 dark:text-red-300">
                  你的答案: {a.question.options[a.selected]}
                </div>
                <div className="px-2 py-1.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  正确答案: {a.question.options[a.question.answer]}
                </div>
              </div>
              <p className="text-xs text-apple-text-secondary">{a.question.explanation}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-6 text-center">
          <GameIcon name="tick" className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-sm font-medium mt-2">全部答对，干得漂亮！</p>
        </div>
      )}

      <button
        onClick={onDone}
        className="w-full py-3 rounded-xl bg-apple-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        完成
      </button>
    </div>
  );
}
