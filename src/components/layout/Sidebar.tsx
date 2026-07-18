import { useChatStore } from '@/store/chatStore';
import MenuIcons from '@/components/sidebar/MenuIcons';
import SessionList from '@/components/sidebar/SessionList';
import NewChatDialog from '@/components/dialogs/NewChatDialog';

export default function Sidebar() {
  const isNewChatDialogOpen = useChatStore((s) => s.isNewChatDialogOpen);
  const setNewChatDialogOpen = useChatStore((s) => s.setNewChatDialogOpen);

  return (
    <div className="h-full flex flex-col">
      {/* App title */}
      <div className="px-4 py-3 border-b border-black/5 dark:border-white/5">
        <h1 className="text-lg font-semibold">話窓</h1>
        <p className="text-[11px] text-apple-text-secondary">Hanamado</p>
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