import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import { useVocabStore } from '@/store/vocabStore';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import VocabBrowse from './VocabBrowse';
import AiVocabBrowse from './AiVocabBrowse';

const TAB_LABELS: Record<string, string> = {
  browse: '浏览',
  ai: 'AI收录',
};

const DEFAULT_WIDTH = 480;

export default function VocabPanel() {
  const isPanelOpen = useVocabStore((s) => s.isPanelOpen);
  const closePanel = useVocabStore((s) => s.closePanel);
  const activeTab = useVocabStore((s) => s.activeTab);
  const setActiveTab = useVocabStore((s) => s.setActiveTab);
  const panelWidth = useVocabStore((s) => s.panelWidth);
  const setPanelWidth = useVocabStore((s) => s.setPanelWidth);

  const { currentWidth, handlePointerDown } = useResizablePanel({
    width: panelWidth,
    minWidth: DEFAULT_WIDTH,
    onChange: setPanelWidth,
  });

  if (!isPanelOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-20 transition-opacity duration-300"
        onClick={closePanel}
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 h-full w-full md:w-[var(--panel-width)] z-30 glass-sidebar
          border-l border-black/5 dark:border-white/5 flex flex-col
          transition-transform duration-300 ease-out translate-x-0"
        style={{ '--panel-width': `${currentWidth}px` } as React.CSSProperties}
      >
        {/* Resize handle */}
        <div
          className="hidden md:block absolute left-0 top-0 bottom-0 w-1 cursor-w-resize z-50
            hover:bg-apple-blue/20 active:bg-apple-blue/30 transition-colors"
          onPointerDown={handlePointerDown}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5">
          <h2 className="font-semibold text-sm">词汇库</h2>
          <button
            onClick={closePanel}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <GameIcon name="cross" className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 mx-3 mt-3 bg-black/[0.03] dark:bg-white/[0.05] rounded-xl">
          {(['browse', 'ai'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all
                ${
                  activeTab === tab
                    ? 'bg-white dark:bg-white/20 shadow-sm text-apple-text dark:text-white'
                    : 'text-apple-text-secondary hover:text-apple-text dark:hover:text-white'
                }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Content */}
        <CustomScrollbar className="flex-1" viewportClassName="px-4 py-4">
          {activeTab === 'browse' && <VocabBrowse />}
          {activeTab === 'ai' && <AiVocabBrowse />}
        </CustomScrollbar>
      </aside>
    </>
  );
}
