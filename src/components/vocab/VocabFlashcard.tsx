import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import { useVocabStore } from '@/store/vocabStore';
import { useVocab } from '@/hooks/useVocab';
import VocabLevelSelector from './VocabLevelSelector';
import Loading from '@/components/common/Loading';
import type { VocabLevel } from '@/types';

export default function VocabFlashcard() {
  const selectedLevel = useVocabStore((s) => s.selectedLevel);
  const setSelectedLevel = useVocabStore((s) => s.setSelectedLevel);
  const isFlashcardActive = useVocabStore((s) => s.isFlashcardActive);
  const flashcardQueue = useVocabStore((s) => s.flashcardQueue);
  const flashcardIndex = useVocabStore((s) => s.flashcardIndex);
  const isFlipped = useVocabStore((s) => s.isFlipped);
  const initFlashcards = useVocabStore((s) => s.initFlashcards);
  const flipCard = useVocabStore((s) => s.flipCard);
  const markFlashcardKnown = useVocabStore((s) => s.markFlashcardKnown);
  const markFlashcardUnknown = useVocabStore((s) => s.markFlashcardUnknown);
  const resetFlashcards = useVocabStore((s) => s.resetFlashcards);

  const { index, isLoading, getUnlearnedEntries } = useVocab();

  const handleSelectLevel = (level: VocabLevel) => {
    setSelectedLevel(level);
    resetFlashcards();
  };

  const handleStart = () => {
    if (!selectedLevel) return;
    const unlearned = getUnlearnedEntries(selectedLevel);
    initFlashcards(unlearned);
  };

  const currentEntry = flashcardQueue[flashcardIndex];
  const progress = flashcardQueue.length > 0
    ? `${flashcardIndex + 1} / ${flashcardQueue.length}`
    : '';

  // Show start screen
  if (!isFlashcardActive) {
    return (
      <div className="flex flex-col h-full">
        <VocabLevelSelector
          selectedLevel={selectedLevel}
          onSelect={handleSelectLevel}
          index={index}
        />

        <div className="flex-1 flex flex-col items-center justify-center">
          {!selectedLevel ? (
            <p className="text-sm text-apple-text-secondary">
              请选择一个级别开始复习
            </p>
          ) : isLoading ? (
            <Loading variant="dots" />
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-apple-text-secondary">
                {getUnlearnedEntries(selectedLevel).length === 0
                  ? '该级别所有单词已掌握！'
                  : `还有 ${getUnlearnedEntries(selectedLevel).length} 个单词待复习`}
              </p>
              <button
                onClick={handleStart}
                disabled={getUnlearnedEntries(selectedLevel).length === 0}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-apple-blue text-white
                  font-medium text-sm shadow-sm hover:opacity-90 transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GameIcon name="play" className="w-[18px] h-[18px]" />
                开始复习
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Flashcard mode
  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-apple-text-secondary">{progress}</span>
        <button
          onClick={resetFlashcards}
          className="flex items-center gap-1 text-xs text-apple-text-secondary hover:text-apple-text transition-colors"
        >
          <GameIcon name="refresh" className="w-3.5 h-3.5" />
          退出
        </button>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div
          className="flashcard w-full max-w-sm aspect-[4/3] cursor-pointer mb-4"
          onClick={flipCard}
        >
          <div className={`flashcard-inner relative w-full h-full ${isFlipped ? 'flipped' : ''}`}>
            {/* Front */}
            <div className="flashcard-front absolute inset-0 glass-card flex flex-col items-center justify-center p-6">
              <span className="text-4xl font-medium mb-3 text-center">
                {currentEntry?.kanji}
              </span>
              <span className="text-sm text-apple-text-secondary">
                {currentEntry?.furigana}
              </span>
              {currentEntry?.pitch && (
                <span className="text-xs text-apple-text-secondary mt-1">
                  {currentEntry?.pitch}
                </span>
              )}
              {currentEntry?.pos && (
                <span className="mt-3 px-2 py-0.5 rounded-full text-[11px] font-medium bg-apple-blue/10 text-apple-blue">
                  {currentEntry?.pos}
                </span>
              )}
              <p className="text-[11px] text-apple-text-secondary mt-4">
                点击翻转
              </p>
            </div>

            {/* Back */}
            <CustomScrollbar className="flashcard-back absolute inset-0 glass-card p-6" viewportClassName="">
              <h4 className="text-xs font-medium text-apple-text-secondary mb-1">
                释义
              </h4>
              <p className="text-sm mb-4">{currentEntry?.definition}</p>
              {currentEntry?.notes && (
                <>
                  <h4 className="text-xs font-medium text-apple-text-secondary mb-1">
                    补充
                  </h4>
                  <p className="text-sm text-apple-text-secondary mb-4">
                    {currentEntry?.notes}
                  </p>
                </>
              )}
              {currentEntry?.sentences && currentEntry.sentences.length > 0 && (
                <>
                  <h4 className="text-xs font-medium text-apple-text-secondary mb-1">
                    例句
                  </h4>
                  {currentEntry.sentences.map((s, i) => (
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

        {/* Action buttons */}
        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={markFlashcardUnknown}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl
              bg-black/[0.03] dark:bg-white/[0.05] text-sm font-medium
              hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
          >
            <GameIcon name="cross" className="w-[18px] h-[18px]" />
            不认识
          </button>
          <button
            onClick={markFlashcardKnown}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl
              bg-apple-blue text-white text-sm font-medium
              hover:opacity-90 transition-all"
          >
            <GameIcon name="tick" className="w-[18px] h-[18px]" />
            认识
          </button>
        </div>
      </div>
    </div>
  );
}