import { useState, useEffect } from 'react';
import GameIcon from '@/components/common/GameIcon';
import type { AiWordEntry, LocalAiEntry, Token, VocabEntry } from '@/types';
import { useDictionary } from '@/hooks/useDictionary';
import { getAiEntry } from '@/services/aiWordStorage';
import { useVocabStore } from '@/store/vocabStore';
import Loading from '@/components/common/Loading';

interface DictViewProps {
  word: string;
  token: Token;
}

function AiWordResultView({ entry, word, isCached }: { entry: AiWordEntry | LocalAiEntry; word: string; isCached?: boolean }) {
  const favKey = `ai:${word}`;
  const isFavorite = useVocabStore((s) => s.isFavorite(favKey));
  const markFavorite = useVocabStore((s) => s.markFavorite);
  const markUnfavorite = useVocabStore((s) => s.markUnfavorite);

  return (
    <div className="space-y-4">
      {/* Header: word and reading */}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-medium">{entry.dictionary_form}</h3>
          <button
            onClick={() => {
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
      </div>

      {/* Parts of speech */}
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
          <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">释义</h4>
          <p className="text-sm leading-relaxed">{entry.definition}</p>
        </div>
      )}

      {/* Example sentences */}
      {entry.example_sentences.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">例句</h4>
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

      {/* Source badge */}
      <div className="text-[10px] text-apple-text-secondary pt-1">
        <GameIcon name="microchip" className="w-3 h-3" />
        <span className="ml-1">{isCached ? 'AI 收录（本地缓存）' : 'AI 查询结果（已收录至本地）'}</span>
      </div>
    </div>
  );
}

function VocabEntryView({ entry }: { entry: VocabEntry }) {
  const isFavorite = useVocabStore((s) => s.isFavorite(entry.id));
  const markFavorite = useVocabStore((s) => s.markFavorite);
  const markUnfavorite = useVocabStore((s) => s.markUnfavorite);

  return (
    <div className="space-y-4">
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
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-apple-blue/10 text-apple-blue">
            {entry.level}
          </span>
        </div>
        <p className="text-sm text-apple-text-secondary mt-1">
          {entry.furigana}
          {entry.pitch && (
            <span className="ml-2 text-xs">{entry.pitch}</span>
          )}
        </p>
      </div>

      {entry.pos && (
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-apple-blue/10 text-apple-blue">
            {entry.pos}
          </span>
        </div>
      )}

      <div>
        <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">释义</h4>
        <p className="text-sm leading-relaxed">{entry.definition}</p>
      </div>

      {entry.notes && (
        <div>
          <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">补充</h4>
          <p className="text-sm text-apple-text-secondary leading-relaxed">{entry.notes}</p>
        </div>
      )}

      {entry.sentences.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">例句</h4>
          <div className="space-y-3">
            {entry.sentences.map((s, i) => (
              <div
                key={i}
                className="pb-3 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0"
              >
                <p className="text-sm">{s.kanji}</p>
                {s.furigana && (
                  <p className="text-xs text-apple-text-secondary mt-0.5">{s.furigana}</p>
                )}
                {s.translation && (
                  <p className="text-xs text-apple-text-secondary mt-0.5">{s.translation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-apple-text-secondary pt-1 flex items-center">
        <GameIcon name="book" className="w-3 h-3" />
        <span className="ml-1">JLPT 词汇库（{entry.level}）</span>
      </div>
    </div>
  );
}

export default function DictView({ word }: DictViewProps) {
  const { lookupWord, loadVocabEntry, queryWordWithAI } = useDictionary();
  const [isQueryingAI, setIsQueryingAI] = useState(false);
  const [aiResult, setAiResult] = useState<AiWordEntry | null>(null);
  const [cachedAiEntry, setCachedAiEntry] = useState<LocalAiEntry | null>(null);
  const [vocabEntry, setVocabEntry] = useState<VocabEntry | null>(null);
  const [isLoadingVocab, setIsLoadingVocab] = useState(false);

  // Favorite state for local dictionary entry
  const dictFavKey = `dict:${word}`;
  const dictIsFav = useVocabStore((s) => s.isFavorite(dictFavKey));
  const markFavorite = useVocabStore((s) => s.markFavorite);
  const markUnfavorite = useVocabStore((s) => s.markUnfavorite);

  const { entry, source, isLoading } = lookupWord(word);

  // When source is 'ai' (found in local AI collection), load the cached entry
  useEffect(() => {
    if (source === 'ai') {
      setCachedAiEntry(getAiEntry(word));
    }
  }, [source, word]);

  // When source is 'vocab' (found in search index), load the full entry
  useEffect(() => {
    if (source === 'vocab' && !vocabEntry && !isLoadingVocab) {
      setIsLoadingVocab(true);
      loadVocabEntry(word)
        .then((result) => {
          setVocabEntry(result);
          setIsLoadingVocab(false);
        })
        .catch(() => setIsLoadingVocab(false));
    }
  }, [source, word, vocabEntry, isLoadingVocab, loadVocabEntry]);

  const handleAIQuery = async () => {
    setIsQueryingAI(true);
    const result = await queryWordWithAI(word);
    if (result) {
      setAiResult(result);
    }
    setIsQueryingAI(false);
  };

  // Loading
  if (isLoading || isLoadingVocab) {
    return <Loading variant="skeleton" lines={4} />;
  }

  // Found in local dictionary
  if (entry) {
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-medium">{entry.word}</h3>
            <button
              onClick={() => {
                if (dictIsFav) {
                  markUnfavorite(dictFavKey);
                } else {
                  markFavorite(dictFavKey);
                }
              }}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title={dictIsFav ? '取消收藏' : '收藏'}
            >
              <GameIcon
                name="star"
                className={dictIsFav ? 'w-5 h-5 text-amber-400' : 'w-5 h-5 text-apple-text-secondary'}
              />
            </button>
          </div>
          <p className="text-sm text-apple-text-secondary mt-1">
            {entry.reading}（{entry.romaji}）
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {entry.pos.map((p, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-apple-blue/10 text-apple-blue"
            >
              {p}
            </span>
          ))}
        </div>
        <div>
          <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">释义</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            {entry.gloss.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ol>
        </div>
        {entry.examples && entry.examples.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-apple-text-secondary mb-1.5">例句</h4>
            <ul className="space-y-1.5 text-sm">
              {entry.examples.map((ex, i) => (
                <li key={i} className="text-apple-text-secondary">{ex}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-[10px] text-apple-text-secondary pt-1 flex items-center">
          <GameIcon name="book" className="w-3 h-3" />
          <span className="ml-1">本地词典</span>
        </div>
      </div>
    );
  }

  // Found in JLPT vocab
  if (vocabEntry) {
    return <VocabEntryView entry={vocabEntry} />;
  }

  // Cached AI word (from local storage)
  if (cachedAiEntry) {
    return <AiWordResultView entry={cachedAiEntry} word={word} isCached />;
  }

  // AI result (fresh query)
  if (aiResult) {
    return <AiWordResultView entry={aiResult} word={word} />;
  }

  // Not found
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-medium">{word}</h3>
      </div>
      <div className="text-center py-6">
        <p className="text-sm text-apple-text-secondary mb-3">本地词典未收录该词</p>
        <button
          onClick={handleAIQuery}
          disabled={isQueryingAI}
          className="text-sm text-apple-blue hover:underline disabled:opacity-40"
        >
          {isQueryingAI ? '查询中...' : '使用 AI 查询'}
        </button>
        <p className="text-[11px] text-apple-text-secondary mt-2">将消耗 API 配额</p>
      </div>
    </div>
  );
}