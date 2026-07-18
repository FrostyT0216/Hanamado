import GameIcon from '@/components/common/GameIcon';
import NewWordCard from './NewWordCard';
import ReviewRunner from './ReviewRunner';
import DictationRunner from './dictation/DictationRunner';
import { useLearning } from '@/hooks/useLearning';
import { useDictation } from '@/hooks/useDictation';

/**
 * 全屏背单词/复习/听写页面。
 * 渲染在 AppLayout 的主内容区（与设置页同级），提供比右侧栏更大的操作空间。
 */
export default function LearningPage() {
  const { isLearningActive, isReviewActive, exitLearning, exitReview } = useLearning();
  const { isDictationActive, exitDictation } = useDictation();

  const handleExit = () => {
    if (isLearningActive) {
      exitLearning();
    } else if (isReviewActive) {
      exitReview(false);
    } else if (isDictationActive) {
      exitDictation();
    }
  };

  const title = isReviewActive
    ? '复习单词'
    : isDictationActive
    ? '听写训练'
    : '学习新词';

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-black/5 dark:border-white/5 flex-shrink-0">
        <button
          onClick={handleExit}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          title="返回聊天"
        >
          <GameIcon name="arrowLeft" className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">{title}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 px-3 py-3">
        <div className="max-w-2xl mx-auto h-full">
          {isLearningActive && <NewWordCard />}
          {isReviewActive && <ReviewRunner />}
          {isDictationActive && <DictationRunner />}
        </div>
      </div>
    </div>
  );
}
