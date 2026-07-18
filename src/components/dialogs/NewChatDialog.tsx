import { useState, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useChatStore } from '@/store/chatStore';
import { ROLES, DIFFICULTY_LABELS, DIFFICULTY_INFO } from '@/data/roles';
import type { Difficulty } from '@/types';
import RoleAvatar from '@/components/common/RoleAvatar';
import Modal from '@/components/common/Modal';
import { sendChatMessage } from '@/services/ai';
import { buildChatSystemPrompt } from '@/utils/prompts';
import { getRoleById } from '@/data/roles';

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewChatDialog({ isOpen, onClose }: NewChatDialogProps) {
  const createSession = useChatStore((s) => s.createSession);
  const addMessage = useChatStore((s) => s.addMessage);
  const apiConfig = useChatStore((s) => s.apiConfig);
  const closeAllOverlays = useChatStore((s) => s.closeAllOverlays);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [whoStarts, setWhoStarts] = useState<'user' | 'ai'>('user');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!selectedRole || isCreating) return;
    setIsCreating(true);

    const sessionId = createSession(selectedRole, difficulty, whoStarts);

    if (whoStarts === 'ai' && apiConfig) {
      const role = getRoleById(selectedRole);
      if (role) {
        const systemPrompt = buildChatSystemPrompt(role, difficulty);
        // Add temporary AI placeholder
        const aiMsgId = nanoid();
        addMessage(sessionId, {
          id: aiMsgId,
          sessionId,
          role: 'ai',
          content: '',
          tokens: [],
          timestamp: Date.now(),
          status: 'sending',
        });

        try {
          const response = await sendChatMessage(
            apiConfig,
            systemPrompt,
            [],
            '（请根据你的角色设定，主动开始对话）'
          );
          useChatStore.getState().updateMessage(sessionId, aiMsgId, {
            content: response.message,
            tokens: response.tokens.map((t, i) => ({ text: t, index: i })),
            translation: response.translation,
            status: 'sent',
          });
        } catch {
          useChatStore.getState().updateMessage(sessionId, aiMsgId, {
            status: 'error',
            content: 'AI 开场白生成失败，请手动开始对话',
          });
        }
      }
    }

    setSelectedRole('');
    setDifficulty('beginner');
    setWhoStarts('user');
    setIsCreating(false);
    onClose();
    closeAllOverlays();
  }, [selectedRole, difficulty, whoStarts, isCreating, apiConfig, createSession, addMessage, onClose, closeAllOverlays]);

  const diffInfo = DIFFICULTY_INFO[difficulty];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新建聊天" width="max-w-lg">
      {/* Role selection */}
      <div className="mb-5">
        <label className="block text-sm font-medium mb-2">选择角色</label>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                ${selectedRole === role.id
                  ? 'border-apple-blue bg-apple-blue/5'
                  : 'border-transparent bg-black/[0.03] dark:bg-white/[0.05] hover:border-black/10 dark:hover:border-white/10'
                }`}
            >
              <RoleAvatar role={role} size={32} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{role.name}</div>
                <div className="text-[11px] text-apple-text-secondary">{role.nameJa}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty selection */}
      <div className="mb-5">
        <label className="block text-sm font-medium mb-2">选择难度</label>
        <div className="flex gap-2 mb-2">
          {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all
                ${difficulty === d
                  ? 'bg-apple-blue text-white'
                  : 'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                }`}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-apple-text-secondary space-y-0.5">
          <p>用词：{diffInfo.vocab} | 语法：{diffInfo.grammar} | 回复：{diffInfo.length}</p>
        </div>
      </div>

      {/* Who starts first */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">谁先开口</label>
        <div className="flex gap-2">
          <button
            onClick={() => setWhoStarts('user')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
              ${whoStarts === 'user'
                ? 'bg-apple-blue text-white'
                : 'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
              }`}
          >
            用户先开口
          </button>
          <button
            onClick={() => setWhoStarts('ai')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
              ${whoStarts === 'ai'
                ? 'bg-apple-blue text-white'
                : 'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
              }`}
          >
            AI 先开口
          </button>
        </div>
      </div>

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={!selectedRole || isCreating}
        className="w-full py-2.5 rounded-xl bg-apple-blue text-white font-medium text-sm
          disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        {isCreating ? '创建中...' : '创建会话'}
      </button>
    </Modal>
  );
}