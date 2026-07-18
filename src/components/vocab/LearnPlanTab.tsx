import LearnSettingsCard from './LearnSettingsCard';
import LearnDashboard from './LearnDashboard';
import LearningResultView from './LearningResultView';
import StageDistributionChart from './StageDistributionChart';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import { useLearning } from '@/hooks/useLearning';

export default function LearnPlanTab() {
  const { lastResult, beginNewBatch, beginReview } = useLearning();

  const handleBeginLearning = async (): Promise<{ ok: boolean; reason?: string }> => {
    const result = await beginNewBatch();
    if (!result.ok) {
      console.warn('[LearnPlanTab] beginNewBatch failed:', result.reason);
    }
    return result;
  };

  const handleBeginReview = async (): Promise<{ ok: boolean; reason?: string }> => {
    const result = await beginReview();
    if (!result.ok) {
      console.warn('[LearnPlanTab] beginReview failed:', result.reason);
    }
    return result;
  };

  if (lastResult) {
    return <LearningResultView />;
  }

  return (
    <CustomScrollbar className="h-full" viewportClassName="space-y-3">
      <LearnSettingsCard />
      <LearnDashboard
        onBeginLearning={handleBeginLearning}
        onBeginReview={handleBeginReview}
      />
      <StageDistributionChart />
    </CustomScrollbar>
  );
}
