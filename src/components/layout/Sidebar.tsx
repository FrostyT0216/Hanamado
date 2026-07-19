import { useChatStore } from '@/store/chatStore';
import MenuIcons from '@/components/sidebar/MenuIcons';
import SessionList from '@/components/sidebar/SessionList';
import NewChatDialog from '@/components/dialogs/NewChatDialog';
import AiConfigStatusCard from '@/components/settings/AiConfigStatusCard';

export default function Sidebar() {
  const isNewChatDialogOpen = useChatStore((s) => s.isNewChatDialogOpen);
  const setNewChatDialogOpen = useChatStore((s) => s.setNewChatDialogOpen);

  return (
    <div className="h-full flex flex-col">
      {/* App title */}
      <div className="px-4 py-3 border-b border-black/5 dark:border-white/5">
        <h1 className="app-title-gradient text-3xl font-bold leading-tight tracking-tight">話窓</h1>
        <p className="text-xs text-apple-text-secondary tracking-wide mt-0.5">Hanamado</p>
        <p className="text-[10px] text-apple-text-secondary/80 mt-1.5 leading-relaxed">
          日语 AI 对话学习工具
        </p>
        <AiConfigStatusCard compact />
      </div>

      {/* Menu icons */}
      <MenuIcons />

      {/* Session list */}
      <SessionList />

      {/* Dialogs */}
      <NewChatDialog isOpen={isNewChatDialogOpen} onClose={() => setNewChatDialogOpen(false)} />
    </div>
  );
}