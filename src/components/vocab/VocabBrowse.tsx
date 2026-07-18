import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import { useVocabStore } from '@/store/vocabStore';
import { useVocab } from '@/hooks/useVocab';
import VocabLevelSelector from './VocabLevelSelector';
import VocabSearchBar from './VocabSearchBar';
import VocabDetail from './VocabDetail';
import Loading from '@/components/common/Loading';
import type { VocabLevel } from '@/types';

export default function VocabBrowse() {
  const selectedLevel = useVocabStore((s) => s.selectedLevel);
  const setSelectedLevel = useVocabStore((s) => s.setSelectedLevel);
  const selectedWord = useVocabStore((s) => s.selectedWord);
  const setSelectedWord = useVocabStore((s) => s.setSelectedWord);
  const isLearned = useVocabStore((s) => s.isLearned);
  const isFavorite = useVocabStore((s) => s.isFavorite);
  const markFavorite = useVocabStore((s) => s.markFavorite);
  const markUnfavorite = useVocabStore((s) => s.markUnfavorite);
  const favoriteFilter = useVocabStore((s) => s.favoriteFilter);
  const toggleFavoriteFilter = useVocabStore((s) => s.toggleFavoriteFilter);

  const { index, filteredEntries, isLoading, error, searchQuery, setSearchQuery } =
    useVocab();

  const handleSelectLevel = (level: VocabLevel) => {
    setSelectedLevel(level);
  };

  // Apply favorite filter
  const displayEntries = favoriteFilter
    ? filteredEntries.filter((entry) => isFavorite(entry.id))
    : filteredEntries;

  // Show detail if a word is selected
  if (selectedWord) {
    return (
      <VocabDetail entry={selectedWord} onBack={() => setSelectedWord(null)} />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Level selector */}
      <VocabLevelSelector
        selectedLevel={selectedLevel}
        onSelect={handleSelectLevel}
        index={index}
      />

      {/* Search bar */}
      {selectedLevel && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1">
            <VocabSearchBar query={searchQuery} onChange={setSearchQuery} />
          </div>
          <button
            onClick={toggleFavoriteFilter}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all
              ${
                favoriteFilter
                  ? 'bg-amber-400/15 text-amber-500'
                  : 'bg-black/[0.03] dark:bg-white/[0.05] text-apple-text-secondary hover:text-apple-text'
              }`}
          >
            <GameIcon name="star" className={`w-[14px] h-[14px] ${favoriteFilter ? 'text-amber-400' : ''}`} />
            收藏
          </button>
        </div>
      )}

      {/* Content */}
      <CustomScrollbar className="flex-1 mt-3 -mx-4" viewportClassName="px-4">
        {!selectedLevel && (
          <div className="text-center py-12">
            <p className="text-sm text-apple-text-secondary">
              请选择一个 JLPT 级别开始浏览
            </p>
          </div>
        )}

        {isLoading && <Loading variant="skeleton" lines={6} />}

        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-difficulty-advanced">{error}</p>
          </div>
        )}

        {selectedLevel && !isLoading && !error && displayEntries.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-apple-text-secondary">
              {favoriteFilter
                ? '暂无收藏的单词'
                : searchQuery
                  ? '未找到匹配的单词'
                  : '该级别暂无数据'}
            </p>
          </div>
        )}

        {selectedLevel && !isLoading && !error && displayEntries.length > 0 && (
          <div className="space-y-0.5">
            {displayEntries.map((entry) => {
              const learned = isLearned(entry.id);
              const favorited = isFavorite(entry.id);
              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedWord(entry)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                    hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium">{entry.kanji}</span>
                      {learned && (
                        <span className="w-1.5 h-1.5 rounded-full bg-difficulty-beginner flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-apple-text-secondary">
                        {entry.furigana}
                      </span>
                      {entry.pitch && (
                        <span className="text-[10px] text-apple-text-secondary">
                          {entry.pitch}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-apple-text-secondary truncate mt-0.5">
                      {entry.definition}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (favorited) {
                        markUnfavorite(entry.id);
                      } else {
                        markFavorite(entry.id);
                      }
                    }}
                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                    title={favorited ? '取消收藏' : '收藏'}
                  >
                    <GameIcon
                      name="star"
                      className={favorited ? 'w-4 h-4 text-amber-400' : 'w-4 h-4 text-apple-text-secondary'}
                    />
                  </button>
                  <GameIcon
                    name="arrowRight"
                    className="w-4 h-4 text-apple-text-secondary flex-shrink-0"
                  />
                </div>
              );
            })}
          </div>
        )}
      </CustomScrollbar>
    </div>
  );
}