import GameIcon from '@/components/common/GameIcon';
import type { LocalAiEntry } from '@/types';
import { removeAiEntry } from '@/services/aiWordStorage';
import { useVocabStore } from '@/store/vocabStore';

interface AiVocabDetailProps {
  entry: LocalAiEntry;
  onBack: () => void;
}

export default function AiVocabDetail({ entry, onBack }: AiVocabDetailProps) {
  const isFavorite = useVocabStore((s) => s.isFavorite(`ai:${entry.word}`));
  const markFavorite = useVocabStore((s) => s.markFavorite);
  const markUnfavorite = useVocabStore((s) => s.markUnfavorite);

  const handleDelete = () => {
    markUnfavorite(`ai:${entry.word}`);
    removeAiEntry(entry.word);
    onBack();
  };

  const savedDate = new Date(entry.savedAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

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
          <h3 className="text-2xl font-medium">{entry.dictionary_form}</h3>
          <button
            onClick={() => {
              const favKey = `ai:${entry.word}`;
              if (isFavorite) {
                markUnfavorite(favKey);
              } else {
                markFavorite(favKey);
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
        </div>
        <p className="text-sm text-apple-text-secondary mt-1">
          {entry.kana_form}
          {entry.romaji && (
            <span className="ml-2 text-xs">（{entry.romaji}）</span>
          )}
          {entry.pitch && (
            <span className="ml-2 text-xs text-apple-blue">{entry.pitch}型</span>
          )}
        </p>
        <p className="text-[10px] text-apple-text-secondary mt-0.5">
          查询词：{entry.word}
        </p>
      </div>

      {/* POS tags */}
      {entry.parts_of_speech.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.parts_of_speech.map((pos, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-apple-blue/10 text-apple-blue"
              title={pos.term}
            >
              {pos.translation || pos.term}
            </span>
          ))}
        </div>
      )}

      {/* Definition */}
      {entry.definition && (
        <div>
          <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">
            释义
          </h4>
          <p className="text-sm leading-relaxed">{entry.definition}</p>
        </div>
      )}

      {/* Example sentences */}
      {entry.example_sentences.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">
            例句
          </h4>
          <div className="space-y-3">
            {entry.example_sentences.map((s, i) => (
              <div
                key={i}
                className="pb-3 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0"
              >
                <p className="text-sm">{s.japanese}</p>
                {s.chinese_translation && (
                  <p className="text-xs text-apple-text-secondary mt-0.5">
                    {s.chinese_translation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source info */}
      <div className="text-[10px] text-apple-text-secondary pt-1 flex items-center gap-1">
        <GameIcon name="microchip" className="w-3 h-3" />
        AI 收录 · 保存于 {savedDate}
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
          bg-difficulty-advanced/10 text-difficulty-advanced hover:bg-difficulty-advanced/20 transition-all"
      >
        <GameIcon name="trash" className="w-4 h-4" />
        删除此词条
      </button>
    </div>
  );
}