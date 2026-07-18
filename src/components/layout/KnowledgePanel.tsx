import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import { useChatStore } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import DictView from '@/components/panel/DictView';
import GrammarView from '@/components/panel/GrammarView';

const DEFAULT_WIDTH = 360;

export default function KnowledgePanel() {
  const panelMode = useChatStore((s) => s.panelMode);
  const panelData = useChatStore((s) => s.panelData);
  const closePanel = useChatStore((s) => s.closePanel);
  const grammarQuery = useChatStore((s) => s.grammarQuery);
  const knowledgePanelWidth = useChatStore((s) => s.knowledgePanelWidth);
  const setKnowledgePanelWidth = useChatStore((s) => s.setKnowledgePanelWidth);

  const { currentWidth, handlePointerDown } = useResizablePanel({
    width: knowledgePanelWidth,
    minWidth: DEFAULT_WIDTH,
    onChange: setKnowledgePanelWidth,
  });

  const { queryGrammarForSentence } = useChat();

  const isOpen = panelMode !== null;

  const handleGrammarRetry = () => {
    if (panelData?.type === 'grammar') {
      queryGrammarForSentence(panelData.sentence, panelData.mode || 'query');
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 transition-opacity duration-300"
          onClick={closePanel}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 h-full w-full md:w-[var(--panel-width)] z-30 glass-sidebar
          border-l border-black/5 dark:border-white/5 flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
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
          <h2 className="font-semibold text-sm">
            {panelMode === 'dict'
              ? '单词详情'
              : panelMode === 'grammar'
                ? grammarQuery.mode === 'correction'
                  ? '语法纠错'
                  : '语法解析'
                : ''}
          </h2>
          <button
            onClick={closePanel}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <GameIcon name="cross" className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Content */}
        <CustomScrollbar className="flex-1" viewportClassName="px-4 py-4">
          {panelMode === 'dict' && panelData?.type === 'dict' && (
            <DictView word={panelData.word} token={panelData.token} />
          )}
          {panelMode === 'grammar' && panelData?.type === 'grammar' && (
            <GrammarView
              sentence={panelData.sentence}
              explanation={grammarQuery.explanation}
              isLoading={grammarQuery.isLoading}
              error={grammarQuery.error}
              onRetry={handleGrammarRetry}
            />
          )}
        </CustomScrollbar>
      </aside>
    </>
  );
}