import GameIcon from '@/components/common/GameIcon';
import LearnPlanTab from './LearnPlanTab';
import { useChatStore } from '@/store/chatStore';

/**
 * 全屏背词计划页面。
 * 渲染在 AppLayout 的主内容区（与设置页、学习页同级），提供比右侧栏更大的操作空间。
 */
export default function LearnPlanPage() {
  const setLearnPlanOpen = useChatStore((s) => s.setLearnPlanOpen);

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-black/5 dark:border-white/5 flex-shrink-0">
        <button
          onClick={() => setLearnPlanOpen(false)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <GameIcon name="arrowLeft" className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">背词计划</h1>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 px-3 py-3">
        <div className="max-w-2xl mx-auto h-full">
          <LearnPlanTab />
        </div>
      </div>
    </div>
  );
}
