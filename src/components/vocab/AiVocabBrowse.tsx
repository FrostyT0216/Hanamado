import { useState, useEffect, useCallback } from 'react';
import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import type { LocalAiEntry } from '@/types';
import { loadAiCollection } from '@/services/aiWordStorage';
import VocabSearchBar from './VocabSearchBar';
import AiVocabDetail from './AiVocabDetail';
import { useVocabStore } from '@/store/vocabStore';

export default function AiVocabBrowse() {
  const [entries, setEntries] = useState<LocalAiEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LocalAiEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Favorite state
  const isFavorite = useVocabStore((s) => s.isFavorite);
  const markFavorite = useVocabStore((s) => s.markFavorite);
  const markUnfavorite = useVocabStore((s) => s.markUnfavorite);
  const favoriteFilter = useVocabStore((s) => s.favoriteFilter);
  const toggleFavoriteFilter = useVocabStore((s) => s.toggleFavoriteFilter);

  const getAiFavKey = (word: string) => `ai:${word}`;

  // Load all AI-collected words
  const loadEntries = useCallback(() => {
    const collection = loadAiCollection();
    // Sort by savedAt descending (newest first)
    const sorted = Object.values(collection).sort((a, b) => b.savedAt - a.savedAt);
    setEntries(sorted);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Listen for real-time updates from aiWordStorage
  useEffect(() => {
    const handleSaved = () => loadEntries();
    const handleRemoved = () => loadEntries();

    window.addEventListener('hanamado-ai-word-saved', handleSaved);
    window.addEventListener('hanamado-ai-word-removed', handleRemoved);

    return () => {
      window.removeEventListener('hanamado-ai-word-saved', handleSaved);
      window.removeEventListener('hanamado-ai-word-removed', handleRemoved);
    };
  }, [loadEntries]);

  // Filter by search query
  const filteredEntries = (() => {
    if (!searchQuery.trim()) return entries;

    const tokens = searchQuery
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.toLowerCase());

    if (tokens.length === 0) return entries;

    return entries.filter((entry) => {
      const haystack = [
        entry.dictionary_form,
        entry.kana_form,
        entry.romaji,
        entry.word,
        ...entry.parts_of_speech.map((p) => `${p.term} ${p.translation}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return tokens.every((token) => haystack.includes(token));
    });
  })();

  // Apply favorite filter
  const displayEntries = favoriteFilter
    ? filteredEntries.filter((entry) => isFavorite(getAiFavKey(entry.word)))
    : filteredEntries;

  // Show detail if a word is selected
  if (selectedEntry) {
    return (
      <AiVocabDetail
        entry={selectedEntry}
        onBack={() => setSelectedEntry(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with count */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-apple-text-secondary">
          共 {entries.length} 个单词
        </span>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
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
          <GameIcon
            name="star"
            className={favoriteFilter ? 'w-3.5 h-3.5 text-amber-400' : 'w-3.5 h-3.5 text-apple-text-secondary'}
          />
          收藏
        </button>
      </div>

      {/* Content */}
      <CustomScrollbar className="flex-1 mt-3 -mx-4" viewportClassName="px-4">
        {entries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-apple-text-secondary">
              暂无 AI 收录的单词
            </p>
            <p className="text-xs text-apple-text-secondary mt-1">
              在对话中点击单词并使用 AI 查询即可收录
            </p>
          </div>
        )}

        {entries.length > 0 && displayEntries.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-apple-text-secondary">
              {favoriteFilter ? '暂无收藏的单词' : '未找到匹配的单词'}
            </p>
          </div>
        )}

        {displayEntries.length > 0 && (
          <div className="space-y-0.5">
            {displayEntries.map((entry) => {
              const favKey = getAiFavKey(entry.word);
              const favorited = isFavorite(favKey);
              return (
                <div
                  key={entry.word}
                  onClick={() => setSelectedEntry(entry)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                    hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium">
                        {entry.dictionary_form}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-apple-text-secondary">
                        {entry.kana_form}
                      </span>
                      {entry.romaji && (
                        <span className="text-[10px] text-apple-text-secondary">
                          {entry.romaji}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {entry.parts_of_speech.slice(0, 3).map((pos, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-apple-blue/70"
                        >
                          {pos.translation || pos.term}
                          {i < Math.min(entry.parts_of_speech.length, 3) - 1 && ' · '}
                        </span>
                      ))}
                    </div>
                    {entry.definition && (
                      <p className="text-xs text-apple-text-secondary truncate mt-0.5">
                        {entry.definition}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (favorited) {
                        markUnfavorite(favKey);
                      } else {
                        markFavorite(favKey);
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