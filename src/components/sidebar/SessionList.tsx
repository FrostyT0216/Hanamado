import { useChatStore } from '@/store/chatStore';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import SessionItem from './SessionItem';

export default function SessionList() {
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const switchSession = useChatStore((s) => s.switchSession);
  const deleteSession = useChatStore((s) => s.deleteSession);

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-xs text-apple-text-secondary text-center">
          暂无会话
          <br />
          点击 + 创建新会话
        </p>
      </div>
    );
  }

  return (
    <CustomScrollbar className="flex-1" viewportClassName="px-2 py-2 space-y-0.5">
      {sorted.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isActive={session.id === currentSessionId}
          onClick={() => switchSession(session.id)}
          onDelete={() => deleteSession(session.id)}
        />
      ))}
    </CustomScrollbar>
  );
}