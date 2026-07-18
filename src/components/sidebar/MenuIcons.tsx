import GameIcon from '@/components/common/GameIcon';
import Tooltip from '@/components/common/Tooltip';
import { useChatStore } from '@/store/chatStore';
import { useVocabStore } from '@/store/vocabStore';
import ThemeToggle from '@/components/common/ThemeToggle';

const iconBtnClass = 'p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors';

export default function MenuIcons() {
  const setNewChatDialogOpen = useChatStore((s) => s.setNewChatDialogOpen);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);
  const setLearnPlanOpen = useChatStore((s) => s.setLearnPlanOpen);
  const setFlashcardOpen = useChatStore((s) => s.setFlashcardOpen);
  const openVocabPanel = useVocabStore((s) => s.openPanel);

  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <Tooltip content="新建聊天" position="right">
        <button
          onClick={() => setNewChatDialogOpen(true)}
          className={iconBtnClass}
        >
          <GameIcon name="plus" className="w-[18px] h-[18px]" />
        </button>
      </Tooltip>
      <Tooltip content="词汇库" position="right">
        <button
          onClick={openVocabPanel}
          className={iconBtnClass}
        >
          <GameIcon name="book" className="w-[18px] h-[18px]" />
        </button>
      </Tooltip>
      <Tooltip content="背词计划" position="right">
        <button
          onClick={() => setLearnPlanOpen(true)}
          className={iconBtnClass}
        >
          <GameIcon name="backpack" className="w-[18px] h-[18px]" />
        </button>
      </Tooltip>
      <Tooltip content="闪卡复习" position="right">
        <button
          onClick={() => setFlashcardOpen(true)}
          className={iconBtnClass}
        >
          <GameIcon name="sparkles" className="w-[18px] h-[18px]" />
        </button>
      </Tooltip>
      <div className="flex-1" />
      <Tooltip content="设置" position="left">
        <button
          onClick={() => setSettingsOpen(true)}
          className={iconBtnClass}
        >
          <GameIcon name="settings" className="w-[18px] h-[18px]" />
        </button>
      </Tooltip>
      <ThemeToggle />
    </div>
  );
}
