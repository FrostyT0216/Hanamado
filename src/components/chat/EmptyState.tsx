import GameIcon from '@/components/common/GameIcon';
import { useChatStore } from '@/store/chatStore';

export default function EmptyState() {
  const setNewChatDialogOpen = useChatStore((s) => s.setNewChatDialogOpen);
  const currentSessionId = useChatStore((s) => s.currentSessionId);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center px-6">
        <div className="flex justify-center mb-4">
          <GameIcon name="message" className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-semibold mb-2">
          {currentSessionId ? '开始对话吧' : '欢迎使用話窓 Hanamado'}
        </h2>
        <p className="bubble-text text-apple-text-secondary mb-4">
          {currentSessionId
            ? '输入第一条日语消息，开始与 AI 对话'
            : '选择左侧会话或创建新会话开始日语对话'}
        </p>
        {!currentSessionId && (
          <button
            onClick={() => setNewChatDialogOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium
              hover:opacity-90 transition-opacity"
          >
            创建新会话
          </button>
        )}
      </div>
    </div>
  );
}