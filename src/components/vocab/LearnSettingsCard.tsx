import { useLearning } from '@/hooks/useLearning';
import type { LearningSettings, VocabLevel } from '@/types';

const BATCH_SIZE_OPTIONS: number[] = [5, 10, 15, 20, 30];
const SOURCE_OPTIONS: { value: LearningSettings['source']; label: string }[] = [
  { value: 'jlpt', label: 'JLPT' },
  { value: 'ai', label: 'AI收录' },
  { value: 'favorite', label: '收藏' },
];
const LEVELS: VocabLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

interface Props {
  /** 关闭学习态后才能修改设置；学习进行中禁用 */
  disabled?: boolean;
}

export default function LearnSettingsCard({ disabled = false }: Props) {
  const { settings, setSettings } = useLearning();

  return (
    <div
      className={`glass-card rounded-2xl p-4 space-y-3 ${
        disabled ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      <h3 className="text-xs font-semibold text-apple-text-secondary uppercase tracking-wide">
        学习设置
      </h3>

      {/* Batch size */}
      <div>
        <label className="text-xs text-apple-text-secondary mb-1.5 block">
          每次背词数量
        </label>
        <div className="flex gap-1.5">
          {BATCH_SIZE_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setSettings({ batchSize: n, dailyNewWordLimit: n })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  settings.batchSize === n
                    ? 'bg-apple-blue text-white shadow-sm'
                    : 'bg-black/[0.03] dark:bg-white/[0.05] text-apple-text-secondary hover:text-apple-text dark:hover:text-white'
                }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Source */}
      <div>
        <label className="text-xs text-apple-text-secondary mb-1.5 block">
          词源
        </label>
        <div className="flex gap-1.5">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSettings({ source: opt.value })}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all
                ${
                  settings.source === opt.value
                    ? 'bg-apple-blue text-white shadow-sm'
                    : 'bg-black/[0.03] dark:bg-white/[0.05] text-apple-text-secondary hover:text-apple-text dark:hover:text-white'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Level picker - only for JLPT source */}
      {settings.source === 'jlpt' && (
        <div>
          <label className="text-xs text-apple-text-secondary mb-1.5 block">
            JLPT 级别
          </label>
          <div className="flex gap-1.5">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => setSettings({ selectedLevel: level })}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all
                  ${
                    settings.selectedLevel === level
                      ? 'bg-apple-blue text-white shadow-sm'
                      : 'bg-black/[0.03] dark:bg-white/[0.05] text-apple-text-secondary hover:text-apple-text dark:hover:text-white'
                  }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
