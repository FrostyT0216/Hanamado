import type { VocabLevel, VocabIndex } from '@/types';

const LEVELS: VocabLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

interface VocabLevelSelectorProps {
  selectedLevel: VocabLevel | null;
  onSelect: (level: VocabLevel) => void;
  index: VocabIndex | null;
}

export default function VocabLevelSelector({
  selectedLevel,
  onSelect,
  index,
}: VocabLevelSelectorProps) {
  return (
    <div className="flex gap-2">
      {LEVELS.map((level) => {
        const count = index?.levels[level]?.count;
        const isSelected = selectedLevel === level;

        return (
          <button
            key={level}
            onClick={() => onSelect(level)}
            className={`flex-1 py-2.5 rounded-xl text-center transition-all duration-200
              ${
                isSelected
                  ? 'bg-apple-blue text-white shadow-sm'
                  : 'bg-black/[0.03] dark:bg-white/[0.05] text-apple-text-secondary hover:text-apple-text dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
              }`}
          >
            <div className="text-sm font-semibold">{level}</div>
            {count !== undefined && (
              <div
                className={`text-[10px] mt-0.5 ${
                  isSelected ? 'text-white/70' : 'text-apple-text-secondary'
                }`}
              >
                {count}词
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}