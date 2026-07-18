import { useEffect, useState } from 'react';
import GameIcon from '@/components/common/GameIcon';
import Loading from '@/components/common/Loading';
import { useLearning } from '@/hooks/useLearning';
import { useDictation } from '@/hooks/useDictation';
import { useVocabStore } from '@/store/vocabStore';
import DictationSourcePicker from './dictation/DictationSourcePicker';

interface Props {
  onBeginLearning: () => Promise<{ ok: boolean; reason?: string }>;
  onBeginReview: () => Promise<{ ok: boolean; reason?: string }>;
}

export default function LearnDashboard({ onBeginLearning, onBeginReview }: Props) {
  const {
    getTodayNewWordCount,
    getTodayDueReviews,
    getMasteredCount,
    getFutureReviewSchedule,
    settings,
    hasApi,
    isLearningActive,
    isReviewActive,
  } = useLearning();
  const { isDictationActive } = useDictation();
  const closePanel = useVocabStore((s) => s.closePanel);

  const isActive = isLearningActive || isReviewActive || isDictationActive;

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStartingLearning, setIsStartingLearning] = useState(false);
  const [isStartingReview, setIsStartingReview] = useState(false);
  const [startElapsed, setStartElapsed] = useState(0);
  const [isDictationPickerOpen, setIsDictationPickerOpen] = useState(false);

  const isStarting = isStartingLearning || isStartingReview;

  const todayNew = getTodayNewWordCount();
  const dueReviews = getTodayDueReviews();
  const masteredCount = getMasteredCount();
  const futureSchedule = getFutureReviewSchedule(7);

  // 准备阶段显示已等待秒数
  useEffect(() => {
    if (!isStarting) return;
    setStartElapsed(0);
    const id = setInterval(() => setStartElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isStarting]);

  const handleBeginLearning = async () => {
    if (isActive) return;
    if (!hasApi) {
      setErrorMsg('请先在设置中配置 API 后再开始学习（出题需要 AI 支持）');
      return;
    }
    setErrorMsg(null);
    setIsStartingLearning(true);
    try {
      const result = await onBeginLearning();
      if (result.ok) {
        closePanel();
      } else {
        setErrorMsg(result.reason || '无法开始学习');
      }
    } finally {
      setIsStartingLearning(false);
    }
  };

  const handleBeginReview = async () => {
    if (isActive) return;
    if (!hasApi) {
      setErrorMsg('请先在设置中配置 API 后再开始复习');
      return;
    }
    if (dueReviews.length === 0) {
      setErrorMsg('今日没有到期的复习任务');
      return;
    }
    setErrorMsg(null);
    setIsStartingReview(true);
    try {
      const result = await onBeginReview();
      if (result.ok) {
        closePanel();
      } else {
        setErrorMsg(result.reason || '无法开始复习');
      }
    } finally {
      setIsStartingReview(false);
    }
  };

  const handleOpenDictationPicker = () => {
    if (isActive) return;
    setErrorMsg(null);
    setIsDictationPickerOpen(true);
  };

  const handleDictationStarted = () => {
    setIsDictationPickerOpen(false);
    closePanel();
  };

  return (
    <div className="space-y-3">
      {/* Dashboard cards */}
      <div className="grid grid-cols-3 gap-2">
        <DashboardCard
          value={todayNew}
          label="今日待学"
          color="text-apple-blue"
        />
        <DashboardCard
          value={dueReviews.length}
          label="今日待复习"
          color="text-amber-500"
        />
        <DashboardCard
          value={masteredCount}
          label="已掌握"
          color="text-emerald-500"
        />
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <GameIcon name="warning" className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleBeginLearning}
          disabled={isActive || isStarting}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-apple-blue text-white
            text-sm font-medium shadow-sm hover:opacity-90 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isStartingLearning ? (
            <Loading variant="spinner" />
          ) : (
            <GameIcon name="play" className="w-4 h-4" />
          )}
          {isStartingLearning ? '准备中...' : '开始学习新词'}
        </button>
        <button
          onClick={handleBeginReview}
          disabled={isActive || dueReviews.length === 0 || isStarting}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
            bg-black/[0.03] dark:bg-white/[0.05] text-sm font-medium
            hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isStartingReview ? (
            <Loading variant="spinner" />
          ) : (
            <GameIcon name="refresh" className="w-4 h-4" />
          )}
          {isStartingReview ? '准备中...' : '开始复习'}
        </button>
      </div>

      {/* 听写按钮 */}
      <button
        onClick={handleOpenDictationPicker}
        disabled={isActive}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
          bg-apple-blue/[0.06] dark:bg-apple-blue/[0.12] text-apple-blue
          text-sm font-medium hover:bg-apple-blue/[0.12] dark:hover:bg-apple-blue/[0.18]
          transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <GameIcon name="ear" className="w-4 h-4" />
        开始听写
      </button>

      {/* 听写词源选择弹窗 */}
      <DictationSourcePicker
        isOpen={isDictationPickerOpen}
        onClose={() => setIsDictationPickerOpen(false)}
        onStarted={handleDictationStarted}
      />

      {isActive && (
        <p className="text-[11px] text-apple-text-secondary text-center">
          当前正在学习/复习/听写中，请在主界面完成
        </p>
      )}

      {/* Starting progress */}
      {isStarting && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-apple-text-secondary">
            <span>{isStartingLearning ? '正在准备新词...' : '正在准备复习...'}</span>
            <span>已等待 {startElapsed}s</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.05] dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-apple-blue/70 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${Math.min(100, (startElapsed / 30) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Future schedule */}
      <div className="glass-card rounded-2xl p-4 space-y-2">
        <h3 className="text-xs font-semibold text-apple-text-secondary uppercase tracking-wide">
          未来 7 天复习计划
        </h3>
        {futureSchedule.every((d) => d.count === 0) ? (
          <p className="text-xs text-apple-text-secondary py-2">
            暂无复习安排，开始学习新词以生成计划
          </p>
        ) : (
          <div className="space-y-1.5">
            {futureSchedule.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-apple-text-secondary">
                  {i === 0 ? '今天' : i === 1 ? '明天' : formatDate(d.date)}
                </span>
                <div className="flex items-center gap-2">
                  {d.count > 0 && (
                    <div className="w-16 h-1 rounded-full bg-black/[0.05] dark:bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full bg-apple-blue"
                        style={{
                          width: `${Math.min(100, (d.count / Math.max(1, dueReviews.length, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  <span
                    className={`font-medium ${d.count > 0 ? 'text-apple-text dark:text-white' : 'text-apple-text-secondary/50'}`}
                  >
                    {d.count} 词
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-apple-text-secondary mt-0.5">{label}</div>
    </div>
  );
}

function formatDate(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}`;
}
