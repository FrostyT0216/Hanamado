import { useState } from 'react';
import Modal from '@/components/common/Modal';
import GameIcon from '@/components/common/GameIcon';
import Loading from '@/components/common/Loading';
import { useDictation } from '@/hooks/useDictation';
import { useLearningStore } from '@/store/learningStore';
import { useVocabStore } from '@/store/vocabStore';
import { loadAiCollection } from '@/services/aiWordStorage';
import DictationWordSelector from './DictationWordSelector';
import type { DictationSource } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStarted: () => void;
}

export default function DictationSourcePicker({ isOpen, onClose, onStarted }: Props) {
  const { settings, setSettings, beginDictation } = useDictation();
  const [source, setSource] = useState<DictationSource>(settings.source);
  const [batchSize, setBatchSize] = useState<number>(settings.batchSize);
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(settings.autoPlayAudio);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // 各词源可用数量
  const wordProgress = useLearningStore((s) => s.wordProgress);
  const favoriteIds = useVocabStore((s) => s.favoriteIds);
  const learningCount = Object.values(wordProgress).filter((p) => p.status === 'learning').length;
  const masteredCount = Object.values(wordProgress).filter((p) => p.status === 'mastered').length;
  const aiCount = Object.keys(loadAiCollection()).length;
  const customCount = favoriteIds.length + aiCount;

  const currentCount =
    source === 'learning' ? learningCount : source === 'mastered' ? masteredCount : customCount;

  const handleStart = async () => {
    setError(null);
    setStarting(true);
    try {
      // 持久化设置
      setSettings({ source, batchSize, autoPlayAudio });
      const result = await beginDictation({ source, batchSize });
      if (result.ok) {
        onStarted();
      } else {
        setError(result.reason || '无法开始听写');
      }
    } finally {
      setStarting(false);
    }
  };

  // 手动选择单词后开始听写
  const handleStartWithWords = async (wordIds: string[]) => {
    setError(null);
    setStarting(true);
    setIsSelectorOpen(false);
    try {
      setSettings({ source, batchSize, autoPlayAudio });
      const result = await beginDictation({ source, batchSize }, wordIds);
      if (result.ok) {
        onStarted();
      } else {
        setError(result.reason || '无法开始听写');
      }
    } finally {
      setStarting(false);
    }
  };

  const openWordSelector = () => {
    if (currentCount === 0) return;
    setError(null);
    setSettings({ source, batchSize, autoPlayAudio });
    setIsSelectorOpen(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="开始听写" width="max-w-lg">
      <div className="space-y-5">
        {/* 词源选择 */}
        <section>
          <h3 className="text-xs font-semibold text-apple-text-secondary uppercase tracking-wide mb-2">
            选择词源
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <SourceCard
              label="学习中"
              count={learningCount}
              selected={source === 'learning'}
              onClick={() => setSource('learning')}
              color="text-amber-500"
            />
            <SourceCard
              label="已掌握"
              count={masteredCount}
              selected={source === 'mastered'}
              onClick={() => setSource('mastered')}
              color="text-emerald-500"
            />
            <SourceCard
              label="自定义"
              count={customCount}
              selected={source === 'custom'}
              onClick={() => setSource('custom')}
              color="text-apple-blue"
            />
          </div>
        </section>

        {/* 数量选择 */}
        <section>
          <h3 className="text-xs font-semibold text-apple-text-secondary uppercase tracking-wide mb-2">
            听写数量
          </h3>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((n) => (
              <button
                key={n}
                onClick={() => setBatchSize(n)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all
                  ${batchSize === n
                    ? 'bg-apple-blue text-white shadow-sm'
                    : 'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                  }`}
              >
                {n} 词
              </button>
            ))}
          </div>
        </section>

        {/* 自动播放 */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoPlayAudio}
            onChange={(e) => setAutoPlayAudio(e.target.checked)}
            className="w-4 h-4 rounded accent-apple-blue"
          />
          <span className="text-sm">进入新词时自动播放音频</span>
        </label>

        {/* 输入提示 */}
        <div className="px-3 py-2.5 rounded-xl bg-apple-blue/[0.06] dark:bg-apple-blue/[0.1]
          text-apple-blue/90 dark:text-apple-blue/80 text-xs flex items-center gap-2">
          <GameIcon name="keyboard" className="w-4 h-4 flex-shrink-0" />
          <span>使用手写输入法获得最佳体验</span>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
            <GameIcon name="warning" className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={starting}
            className="flex-1 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]
              text-sm font-medium hover:bg-black/[0.06] dark:hover:bg-white/[0.08]
              transition-colors disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={openWordSelector}
            disabled={starting || currentCount === 0}
            title={currentCount === 0 ? '当前词源无可用单词' : '手动选择要听写的单词'}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
              bg-black/[0.03] dark:bg-white/[0.05] text-sm font-medium
              hover:bg-black/[0.06] dark:hover:bg-white/[0.08]
              transition-colors disabled:opacity-40"
          >
            <GameIcon name="book" className="w-4 h-4" />
            选择单词
          </button>
          <button
            onClick={handleStart}
            disabled={starting}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl
              bg-apple-blue text-white text-sm font-medium shadow-sm
              hover:opacity-90 transition-all disabled:opacity-40"
          >
            {starting ? (
              <Loading variant="spinner" />
            ) : (
              <GameIcon name="play" className="w-4 h-4" />
            )}
            {starting ? '准备中...' : '随机抽取'}
          </button>
        </div>
      </div>

      {/* 单词列表选择器（嵌套） */}
      <DictationWordSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        source={source}
        onStart={handleStartWithWords}
      />
    </Modal>
  );
}

function SourceCard({
  label,
  count,
  selected,
  onClick,
  color,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className={`p-3 rounded-2xl border text-center transition-all
        ${selected
          ? 'border-apple-blue bg-apple-blue/5 dark:bg-apple-blue/10'
          : 'border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10'
        }
        ${count === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <div className={`text-2xl font-bold ${color}`}>{count}</div>
      <div className="text-xs text-apple-text-secondary mt-0.5">{label}</div>
    </button>
  );
}
