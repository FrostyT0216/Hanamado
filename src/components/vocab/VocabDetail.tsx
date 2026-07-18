import GameIcon from '@/components/common/GameIcon';
import type { VocabEntry } from '@/types';
import { useVocabStore } from '@/store/vocabStore';
import { useLearningStore } from '@/store/learningStore';

interface VocabDetailProps {
  entry: VocabEntry;
  onBack: () => void;
}

export default function VocabDetail({ entry, onBack }: VocabDetailProps) {
  const isLearned = useVocabStore((s) => s.isLearned(entry.id));
  const markLearned = useVocabStore((s) => s.markLearned);
  const markUnlearned = useVocabStore((s) => s.markUnlearned);
  const isFavorite = useVocabStore((s) => s.isFavorite(entry.id));
  const markFavorite = useVocabStore((s) => s.markFavorite);
  const markUnfavorite = useVocabStore((s) => s.markUnfavorite);

  // 新学习系统的进度
  const learningProgress = useLearningStore((s) => s.wordProgress[entry.id]);

  const handleToggleLearned = () => {
    if (isLearned) {
      markUnlearned(entry.id);
    } else {
      markLearned(entry.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-apple-text-secondary hover:text-apple-text transition-colors"
      >
        <GameIcon name="arrowLeft" className="w-4 h-4" />
        返回列表
      </button>

      {/* Word header */}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-medium">{entry.kanji}</h3>
          <button
            onClick={() => {
              if (isFavorite) {
                markUnfavorite(entry.id);
              } else {
                markFavorite(entry.id);
              }
            }}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title={isFavorite ? '取消收藏' : '收藏'}
          >
            <GameIcon
              name="star"
              className={isFavorite ? 'w-5 h-5 text-amber-400' : 'w-5 h-5 text-apple-text-secondary'}
            />
          </button>
          {isLearned && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-difficulty-beginner/15 text-difficulty-beginner">
              已掌握
            </span>
          )}
          {learningProgress?.status === 'mastered' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              已掌握
            </span>
          )}
          {learningProgress?.status === 'learning' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-apple-blue/15 text-apple-blue">
              学习中 · 第 {learningProgress.currentStage}/5 阶
            </span>
          )}
        </div>
        <p className="text-sm text-apple-text-secondary mt-1">
          {entry.furigana}
          {entry.pitch && (
            <span className="ml-2 text-xs text-apple-text-secondary">
              {entry.pitch}
            </span>
          )}
        </p>
      </div>

      {/* POS tags */}
      {entry.pos && (
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-apple-blue/10 text-apple-blue">
            {entry.pos}
          </span>
        </div>
      )}

      {/* Definition */}
      <div>
        <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">
          释义
        </h4>
        <p className="text-sm leading-relaxed">{entry.definition}</p>
      </div>

      {/* Notes */}
      {entry.notes && (
        <div>
          <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">
            补充
          </h4>
          <p className="text-sm text-apple-text-secondary leading-relaxed">
            {entry.notes}
          </p>
        </div>
      )}

      {/* Example sentences */}
      {entry.sentences.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">
            例句
          </h4>
          <div className="space-y-3">
            {entry.sentences.map((s, i) => (
              <div
                key={i}
                className="pb-3 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0"
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
          </div>
        </div>
      )}

      {/* Learned toggle */}
      <button
        onClick={handleToggleLearned}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
          ${
            isLearned
              ? 'bg-black/[0.03] dark:bg-white/[0.05] text-apple-text-secondary hover:text-apple-text'
              : 'bg-apple-blue text-white hover:opacity-90'
          }`}
      >
        {isLearned ? (
          <>
            <GameIcon name="cross" className="w-4 h-4" />
            标记为未掌握
          </>
        ) : (
          <>
            <GameIcon name="tick" className="w-4 h-4" />
            标记为已掌握
          </>
        )}
      </button>
    </div>
  );
}