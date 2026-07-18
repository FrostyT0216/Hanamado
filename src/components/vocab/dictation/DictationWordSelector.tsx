import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/common/Modal';
import GameIcon from '@/components/common/GameIcon';
import Loading from '@/components/common/Loading';
import { listDictationCandidates } from '@/services/dictationService';
import type { DictationSource } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  source: DictationSource;
  onStart: (wordIds: string[]) => void;
}

/**
 * 单词列表选择器：
 * 列出某词源下所有可听写的单词，用户可多选或随机抽取后开始听写。
 */
export default function DictationWordSelector({ isOpen, onClose, source, onStart }: Props) {
  const [views, setViews] = useState<Awaited<ReturnType<typeof listDictationCandidates>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [randomCount, setRandomCount] = useState(10);

  // 词源切换时重新加载候选列表
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(new Set());
    listDictationCandidates(source)
      .then((list) => {
        if (cancelled) return;
        setViews(list);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '加载单词列表失败');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, source]);

  const toggleSelect = (wordId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(views.map((v) => v.wordId)));

  const invertSelection = () => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const v of views) {
        if (!prev.has(v.wordId)) next.add(v.wordId);
      }
      return next;
    });
  };

  const clearAll = () => setSelected(new Set());

  // 随机抽取 N 个
  const pickRandom = () => {
    const n = Math.min(randomCount, views.length);
    if (n === 0) return;
    const shuffled = [...views];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setSelected(new Set(shuffled.slice(0, n).map((v) => v.wordId)));
  };

  const sortedViews = useMemo(() => {
    // 已选的排前面，便于查看
    return [...views].sort((a, b) => {
      const aSel = selected.has(a.wordId) ? 0 : 1;
      const bSel = selected.has(b.wordId) ? 0 : 1;
      return aSel - bSel;
    });
  }, [views, selected]);

  const handleStart = () => {
    if (selected.size === 0) return;
    onStart(Array.from(selected));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`选择听写单词 · ${sourceLabel(source)}`} width="max-w-2xl">
      <div className="space-y-4">
        {/* 加载中 */}
        {loading && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loading variant="spinner" />
            <p className="text-xs text-apple-text-secondary">正在加载单词列表...</p>
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
            <GameIcon name="warning" className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 工具栏 */}
        {!loading && !error && views.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]
                  transition-colors"
              >
                全选
              </button>
              <button
                onClick={invertSelection}
                className="px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]
                  transition-colors"
              >
                反选
              </button>
              <button
                onClick={clearAll}
                disabled={selected.size === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]
                  transition-colors disabled:opacity-40"
              >
                清空
              </button>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-apple-text-secondary">随机</span>
                <input
                  type="number"
                  min={1}
                  max={views.length}
                  value={randomCount}
                  onChange={(e) =>
                    setRandomCount(Math.max(1, Math.min(views.length, Number(e.target.value) || 1)))
                  }
                  className="w-14 px-2 py-1 rounded-md text-xs text-center
                    bg-white/70 dark:bg-white/[0.06] border border-black/10 dark:border-white/10
                    focus:outline-none focus:ring-1 focus:ring-apple-blue/40"
                />
                <button
                  onClick={pickRandom}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium
                    bg-apple-blue/10 dark:bg-apple-blue/20 text-apple-blue
                    hover:bg-apple-blue/20 dark:hover:bg-apple-blue/30 transition-colors"
                >
                  抽取
                </button>
              </div>
            </div>

            {/* 已选统计 */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-apple-text-secondary">
                共 {views.length} 词 · 已选
                <span className="ml-1 font-medium text-apple-blue">{selected.size}</span>
              </span>
            </div>

            {/* 单词列表 */}
            <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 space-y-1">
              {sortedViews.map((v) => {
                const isSelected = selected.has(v.wordId);
                return (
                  <button
                    key={v.wordId}
                    onClick={() => toggleSelect(v.wordId)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                      transition-all border
                      ${isSelected
                        ? 'border-apple-blue/40 bg-apple-blue/[0.06] dark:bg-apple-blue/[0.12]'
                        : 'border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                      }`}
                  >
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center
                        transition-colors
                        ${isSelected
                          ? 'bg-apple-blue text-white'
                          : 'bg-black/[0.06] dark:bg-white/[0.1] text-transparent'
                        }`}
                    >
                      {isSelected && <GameIcon name="tick" className="w-3.5 h-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0 flex items-baseline gap-2">
                      <span className="text-sm font-medium text-apple-text dark:text-white truncate">
                        {v.expected}
                      </span>
                      <span className="text-xs text-apple-text-secondary truncate">
                        {v.kana}
                      </span>
                    </div>
                    <span className="flex-shrink-0 text-xs text-apple-text-secondary truncate max-w-[40%]">
                      {v.meaning || '（无翻译）'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 底部操作 */}
            <div className="flex gap-2 pt-1 border-t border-black/5 dark:border-white/5">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]
                  text-sm font-medium hover:bg-black/[0.06] dark:hover:bg-white/[0.08]
                  transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleStart}
                disabled={selected.size === 0}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl
                  bg-apple-blue text-white text-sm font-medium shadow-sm
                  hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GameIcon name="play" className="w-4 h-4" />
                开始听写（{selected.size} 词）
              </button>
            </div>
          </>
        )}

        {/* 空列表 */}
        {!loading && !error && views.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <GameIcon name="warning" className="w-8 h-8 text-apple-text-secondary/40" />
            <p className="text-sm text-apple-text-secondary">
              该词源下暂无可用单词
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function sourceLabel(source: DictationSource): string {
  switch (source) {
    case 'learning':
      return '学习中';
    case 'mastered':
      return '已掌握';
    case 'custom':
      return '自定义';
    default:
      return source;
  }
}
