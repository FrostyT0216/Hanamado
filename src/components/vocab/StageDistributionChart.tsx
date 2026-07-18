import { useLearning } from '@/hooks/useLearning';

/**
 * 简易阶段分布条形图（新词 / 学习中 / 已掌握）。
 * 不引入第三方图表库，纯 div + width 百分比。
 */
export default function StageDistributionChart() {
  const { getStageDistribution, getMasteredCount, wordProgress, getCandidateWordIdsCount } = useLearning();

  const dist = getStageDistribution();
  const candidateCount = getCandidateWordIdsCount();
  const totalLearned = Object.keys(wordProgress).length;
  const newCount = Math.max(0, candidateCount - totalLearned);

  // 总数 = 候选词数；若无候选（如 AI/收藏），退化为已学+0
  const total = candidateCount > 0 ? candidateCount : dist.learning + dist.mastered;
  const segments = [
    { label: '新词', count: newCount, color: 'bg-apple-text-secondary/40' },
    { label: '学习中', count: dist.learning, color: 'bg-apple-blue' },
    { label: '已掌握', count: dist.mastered, color: 'bg-emerald-500' },
  ];

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <h3 className="text-xs font-semibold text-apple-text-secondary uppercase tracking-wide">
        阶段分布
      </h3>

      {/* 堆叠条 */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-black/[0.03] dark:bg-white/[0.05]">
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.count / total) * 100 : 0;
          return (
            <div
              key={seg.label}
              className={`${seg.color} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${seg.count}`}
            />
          );
        })}
      </div>

      {/* 图例 */}
      <div className="space-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${seg.color}`} />
              <span className="text-apple-text-secondary">{seg.label}</span>
            </div>
            <span className="font-medium">{seg.count}</span>
          </div>
        ))}
      </div>

      {/* 总数 */}
      <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
        <span className="text-apple-text-secondary">词库总数</span>
        <span className="font-medium">{candidateCount}</span>
      </div>
    </div>
  );
}
