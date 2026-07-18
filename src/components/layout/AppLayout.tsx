import { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useLearningStore } from '@/store/learningStore';
import { useDictationStore } from '@/store/dictationStore';
import { useVocabInit } from '@/hooks/useVocabInit';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import KnowledgePanel from './KnowledgePanel';
import VocabPanel from '@/components/vocab/VocabPanel';
import SettingsPage from '@/components/settings/SettingsPanel';
import LearningPage from '@/components/vocab/LearningPage';
import LearnPlanPage from '@/components/vocab/LearnPlanPage';
import FlashcardPage from '@/components/vocab/FlashcardPage';

export default function AppLayout() {
  const isSidebarOpen = useChatStore((s) => s.isSidebarOpen);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const isSettingsOpen = useChatStore((s) => s.isSettingsOpen);
  const isLearnPlanOpen = useChatStore((s) => s.isLearnPlanOpen);
  const isFlashcardOpen = useChatStore((s) => s.isFlashcardOpen);
  const setLearnPlanOpen = useChatStore((s) => s.setLearnPlanOpen);
  const backgroundPattern = useChatStore((s) => s.backgroundPattern);
  const { isLoading: isVocabLoading, progress: vocabProgress } = useVocabInit();

  const isLearningActive = useLearningStore((s) => s.isLearningActive);
  const isReviewActive = useLearningStore((s) => s.isReviewActive);
  const lastResult = useLearningStore((s) => s.lastResult);
  const isDictationActive = useDictationStore((s) => s.isDictationActive);

  const isLearningMode = isLearningActive || isReviewActive || isDictationActive;

  // 练习结束后回到背词计划页面展示结果（替代原"打开词汇库 learn tab"逻辑）
  useEffect(() => {
    if (lastResult && !isLearningActive && !isReviewActive) {
      setLearnPlanOpen(true);
    }
  }, [lastResult, isLearningActive, isReviewActive, setLearnPlanOpen]);

  // 仅在启用背景装饰图案时让 main 透明，以露出 body::before 装饰层；
  // 纯色模式下保留 main 的实色背景，避免任何情况下出现纯白
  const hasPattern = backgroundPattern !== 'solid';

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Vocab loading progress bar */}
      {isVocabLoading && (
        <div className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-black/[0.03] dark:bg-white/[0.05]">
          <div
            className="h-full bg-apple-blue transition-all duration-300 ease-out"
            style={{ width: `${Math.round(vocabProgress * 100)}%` }}
          />
        </div>
      )}
      {/* Sidebar */}
      <aside
        className={`w-[260px] flex-shrink-0 h-full glass-sidebar z-40
          max-md:fixed max-md:transition-transform max-md:duration-300
          ${isSidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}`}
      >
        <Sidebar />
      </aside>

      {/* Main content area */}
      <main
        className={`flex-1 flex flex-col min-w-0 relative z-10 transition-colors duration-300
          ${hasPattern ? 'bg-transparent' : 'bg-apple-gray dark:bg-apple-dark'}`}
      >
        {/* Chat Area */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-out
            ${isSettingsOpen || isLearningMode || isLearnPlanOpen || isFlashcardOpen
              ? 'opacity-0 pointer-events-none translate-x-[-24px]'
              : 'opacity-100 translate-x-0'}`}
        >
          <ChatArea />
        </div>

        {/* Learn Plan Page：背词计划 */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-out
            ${isLearnPlanOpen && !isLearningMode && !isSettingsOpen
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 pointer-events-none translate-x-[24px]'}`}
        >
          <LearnPlanPage />
        </div>

        {/* Flashcard Page：闪卡复习 */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-out
            ${isFlashcardOpen && !isLearningMode && !isSettingsOpen
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 pointer-events-none translate-x-[24px]'}`}
        >
          <FlashcardPage />
        </div>

        {/* Learning Page：全屏背单词/复习 */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-out
            ${isLearningMode && !isSettingsOpen
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 pointer-events-none translate-x-[24px]'}`}
        >
          <LearningPage />
        </div>

        {/* Settings Page */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-out
            ${isSettingsOpen ? 'opacity-100 translate-x-0' : 'opacity-0 pointer-events-none translate-x-[24px]'}`}
        >
          <SettingsPage />
        </div>
      </main>

      {/* Knowledge panel overlay */}
      <KnowledgePanel />

      {/* Vocab panel overlay */}
      <VocabPanel />

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-30"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
}