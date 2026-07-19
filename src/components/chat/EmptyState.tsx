import GameIcon from '@/components/common/GameIcon';
import AiConfigStatusCard from '@/components/settings/AiConfigStatusCard';
import { useChatStore } from '@/store/chatStore';

export default function EmptyState() {
  const setNewChatDialogOpen = useChatStore((s) => s.setNewChatDialogOpen);
  const currentSessionId = useChatStore((s) => s.currentSessionId);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center px-6 max-w-md w-full">
        <div className="flex justify-center mb-4">
          <GameIcon name="message" className="w-12 h-12" />
        </div>

        {currentSessionId ? (
          <>
            <h2 className="text-xl font-semibold mb-2">开始对话吧</h2>
            <p className="bubble-text text-apple-text-secondary mb-4">
              输入第一条日语消息，开始与 AI 对话
            </p>

            <div className="text-left mb-4">
              <AiConfigStatusCard />
            </div>
          </>
        ) : (
          <>
            <h2 className="app-title-gradient text-5xl font-bold leading-tight tracking-tight mb-1">
              話窓
            </h2>
            <p className="text-base font-medium text-apple-text-secondary tracking-wide mb-2">
              Hanamado
            </p>
            <p className="text-sm text-apple-text-secondary mb-5">
              一款日语 AI 对话学习工具
            </p>

            <div className="text-left mb-5">
              <AiConfigStatusCard />
            </div>

            <button
              onClick={() => setNewChatDialogOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium
                hover:opacity-90 transition-opacity"
            >
              创建新会话
            </button>
          </>
        )}
      </div>
    </div>
  );
}