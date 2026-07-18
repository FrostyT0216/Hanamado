import { useState } from 'react';
import GameIcon from '@/components/common/GameIcon';
import RoleAvatar from '@/components/common/RoleAvatar';
import type { Session } from '@/types';
import { getRoleById, DIFFICULTY_LABELS } from '@/data/roles';
import { formatRelativeTime } from '@/utils/timeFormat';
import ContextMenu from '@/components/common/ContextMenu';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

const difficultyColors: Record<string, string> = {
  beginner: 'bg-difficulty-beginner/10 text-difficulty-beginner',
  intermediate: 'bg-difficulty-intermediate/10 text-difficulty-intermediate',
  advanced: 'bg-difficulty-advanced/10 text-difficulty-advanced',
};

export default function SessionItem({ session, isActive, onClick, onDelete }: SessionItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const role = getRoleById(session.roleId);
  const lastMessage = session.messages[session.messages.length - 1];

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150
          ${isActive
            ? 'bg-apple-blue/10 border-l-[3px] border-apple-blue'
            : 'hover:bg-black/5 dark:hover:bg-white/5 border-l-[3px] border-transparent'
          }`}
      >
        <div className="flex items-center gap-2 mb-1">
          {role && <RoleAvatar role={role} size={20} />}
          <span className="text-sm font-medium truncate">{role?.name ?? '未知角色'}</span>
          <span
            className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${difficultyColors[session.difficulty] ?? ''}`}
          >
            {DIFFICULTY_LABELS[session.difficulty] ?? session.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-apple-text-secondary truncate flex-1">
            {lastMessage
              ? lastMessage.content.slice(0, 40) + (lastMessage.content.length > 40 ? '...' : '')
              : '新会话'}
          </p>
          <span className="text-[10px] text-apple-text-secondary flex-shrink-0">
            {formatRelativeTime(session.updatedAt)}
          </span>
        </div>
      </div>

      <ContextMenu
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        isOpen={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        items={[
          {
            label: '删除会话',
            icon: <GameIcon name="trash" className="w-[14px] h-[14px]" />,
            onClick: onDelete,
            danger: true,
          },
        ]}
      />
    </>
  );
}