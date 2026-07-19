import { useState, useCallback, useMemo, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useChatStore } from '@/store/chatStore';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_INFO,
  REPLY_LENGTH_LABELS,
  REPLY_LENGTH_INFO,
  REPLY_LENGTH_ORDER,
  getRoleById,
  getRolesByCategory,
  parsePersona,
} from '@/data/roles';
import type { Difficulty, ReplyLength, Role } from '@/types';
import RoleAvatar from '@/components/common/RoleAvatar';
import Modal from '@/components/common/Modal';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import { sendChatMessage } from '@/services/ai';
import { buildChatSystemPrompt } from '@/utils/prompts';

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 回复长度 5 档吸附滑块 */
function LengthSlider({
  value,
  onChange,
}: {
  value: ReplyLength;
  onChange: (v: ReplyLength) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const currentIndex = REPLY_LENGTH_ORDER.indexOf(value);
  const percent = (currentIndex / (REPLY_LENGTH_ORDER.length - 1)) * 100;

  const updateFromX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const idx = Math.round(ratio * (REPLY_LENGTH_ORDER.length - 1));
      onChange(REPLY_LENGTH_ORDER[idx]);
    },
    [onChange]
  );

  return (
    <div className="select-none">
      {/* 5 个档位标签 */}
      <div className="flex justify-between text-[10px] mb-1.5 px-0.5">
        {REPLY_LENGTH_ORDER.map((lvl) => (
          <span
            key={lvl}
            className={`transition-colors duration-200
              ${value === lvl ? 'text-apple-blue font-semibold' : 'text-apple-text-secondary/70'}`}
          >
            {REPLY_LENGTH_LABELS[lvl]}
          </span>
        ))}
      </div>

      {/* 轨道 + thumb */}
      <div
        ref={trackRef}
        className="relative h-4 flex items-center cursor-pointer touch-none"
        onPointerDown={(e) => {
          setDragging(true);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          updateFromX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging) updateFromX(e.clientX);
        }}
        onPointerUp={(e) => {
          setDragging(false);
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        }}
      >
        {/* 轨道底色 */}
        <div className="absolute left-0 right-0 h-1 bg-black/10 dark:bg-white/10 rounded-full" />
        {/* 已选高亮 */}
        <div
          className="absolute left-0 h-1 bg-apple-blue rounded-full"
          style={{ width: `${percent}%`, transition: dragging ? 'none' : 'width 200ms ease-out' }}
        />
        {/* 5 个档位刻度点 */}
        {REPLY_LENGTH_ORDER.map((lvl, i) => {
          const p = (i / (REPLY_LENGTH_ORDER.length - 1)) * 100;
          const isPassed = i <= currentIndex;
          return (
            <div
              key={lvl}
              className={`absolute w-1.5 h-1.5 rounded-full transition-colors duration-200
                ${isPassed ? 'bg-apple-blue' : 'bg-black/25 dark:bg-white/30'}`}
              style={{ left: `${p}%`, transform: 'translateX(-50%)' }}
            />
          );
        })}
        {/* Thumb */}
        <div
          className={`absolute w-4 h-4 rounded-full bg-white border-2 border-apple-blue shadow-sm
            ${dragging ? 'scale-110' : ''} transition-transform duration-150`}
          style={{
            left: `${percent}%`,
            transform: 'translateX(-50%)',
            transition: dragging
              ? 'transform 150ms ease-out'
              : 'left 200ms cubic-bezier(0.34,1.56,0.64,1), transform 150ms ease-out',
          }}
        />
      </div>
    </div>
  );
}

/** 分段渲染 persona：把"身份：..."等段落拆成带标签的小节 */
function PersonaPreview({ persona }: { persona: string }) {
  const sections = useMemo(() => parsePersona(persona), [persona]);
  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      {sections.map((sec, i) => (
        <div key={i}>
          {sec.label && (
            <div className="mb-1.5">
              <span className="px-1.5 py-0.5 rounded-md bg-apple-blue/10 text-apple-blue text-[10px] font-semibold leading-snug">
                {sec.label}
              </span>
            </div>
          )}
          <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-apple-text-primary/85">
            {sec.content}
          </p>
        </div>
      ))}
    </div>
  );
}

/** 角色选择卡片：选中后再次点击可展开/收起人设详情（带动画） */
function RoleCard({
  role,
  selected,
  expanded,
  onClick,
}: {
  role: Role;
  selected: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  const hasDetail = Boolean(role.persona);

  return (
    <div
      className={`rounded-xl border-2 transition-all duration-300 ease-out
        ${selected
          ? 'border-apple-blue bg-apple-blue/5 shadow-sm shadow-apple-blue/10'
          : 'border-transparent bg-black/[0.03] dark:bg-white/[0.05] hover:border-black/10 dark:hover:border-white/10'
        }
        ${expanded ? 'col-span-2' : ''}`}
    >
      <button
        onClick={onClick}
        className="flex items-center gap-3 p-2.5 w-full text-left"
      >
        <RoleAvatar role={role} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{role.name}</div>
          <div className="text-[11px] text-apple-text-secondary truncate">{role.nameJa}</div>
          {role.description && (
            <div className="text-[10px] text-apple-text-secondary/70 truncate mt-0.5">
              {role.description}
            </div>
          )}
        </div>
        {/* 选中态下，有详情的角色显示展开指示箭头 */}
        {hasDetail && selected && (
          <svg
            className={`flex-shrink-0 w-4 h-4 text-apple-text-secondary
              transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
              ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        )}
      </button>

      {/* 可展开的人设详情：grid-rows 0fr→1fr 实现高度自适应动画 */}
      {hasDetail && (
        <div
          className={`grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        >
          <div className="overflow-hidden">
            <div
              className={`px-3 pb-3 pt-1 border-t border-black/5 dark:border-white/10 mt-1
                transition-all duration-500 ease-out
                ${expanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
            >
              <PersonaPreview persona={role.persona!} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewChatDialog({ isOpen, onClose }: NewChatDialogProps) {
  const createSession = useChatStore((s) => s.createSession);
  const addMessage = useChatStore((s) => s.addMessage);
  const apiConfig = useChatStore((s) => s.apiConfig);
  const closeAllOverlays = useChatStore((s) => s.closeAllOverlays);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [replyLength, setReplyLength] = useState<ReplyLength>('medium');
  const [whoStarts, setWhoStarts] = useState<'user' | 'ai'>('user');
  const [isCreating, setIsCreating] = useState(false);

  const { basic, story } = useMemo(() => getRolesByCategory(), []);

  const handleRoleClick = useCallback((roleId: string) => {
    const role = getRoleById(roleId);
    if (!role) return;

    if (selectedRole !== roleId) {
      // 第一次点击：选中角色，收起任何已展开的卡片
      setSelectedRole(roleId);
      setExpandedRole(null);
    } else if (role.persona) {
      // 再次点击已选中的角色：切换展开/收起（仅对有详情的角色生效）
      setExpandedRole((prev) => (prev === roleId ? null : roleId));
    }
  }, [selectedRole]);

  const handleCreate = useCallback(async () => {
    if (!selectedRole || isCreating) return;
    setIsCreating(true);

    const sessionId = createSession(selectedRole, difficulty, whoStarts, replyLength);

    if (whoStarts === 'ai' && apiConfig) {
      const role = getRoleById(selectedRole);
      if (role) {
        const systemPrompt = buildChatSystemPrompt(role, difficulty, replyLength);
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
            '（请根据你的角色设定，主动开始对话）',
            replyLength
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
    setExpandedRole(null);
    setDifficulty('beginner');
    setReplyLength('medium');
    setWhoStarts('user');
    setIsCreating(false);
    onClose();
    closeAllOverlays();
  }, [selectedRole, difficulty, replyLength, whoStarts, isCreating, apiConfig, createSession, addMessage, onClose, closeAllOverlays]);

  const diffInfo = DIFFICULTY_INFO[difficulty];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新建聊天" width="max-w-2xl">
      {/* Role selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-3">
          选择角色
          <span className="ml-2 text-[11px] font-normal text-apple-text-secondary/70">
            · 选中后再次点击可展开人设
          </span>
        </label>

        {/* 角色列表：固定高度内部滚动 */}
        <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 overflow-hidden">
          <CustomScrollbar className="h-[32vh] min-h-[180px]" viewportClassName="h-full p-2">
            {/* 基础角色 */}
            {basic.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] uppercase tracking-wider text-apple-text-secondary/60 mb-1.5 px-1">
                  基础角色 · Basic
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {basic.map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      selected={selectedRole === role.id}
                      expanded={expandedRole === role.id}
                      onClick={() => handleRoleClick(role.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 沉浸式剧情角色 */}
            {story.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-apple-text-secondary/60 mb-1.5 px-1 flex items-center gap-1.5 flex-wrap">
                  <span>沉浸式剧情角色 · Story</span>
                  <span className="text-apple-blue/70 normal-case tracking-normal">
                    — 含完整人设
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {story.map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      selected={selectedRole === role.id}
                      expanded={expandedRole === role.id}
                      onClick={() => handleRoleClick(role.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </CustomScrollbar>
        </div>
      </div>

      {/* Difficulty selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">选择难度</label>
        <div className="flex gap-2 mb-1.5">
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
        <div className="text-[11px] text-apple-text-secondary">
          <p>用词：{diffInfo.vocab} | 语法：{diffInfo.grammar}</p>
        </div>
      </div>

      {/* Reply length preference (5 levels, slider) */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="text-sm font-medium">回复长度</label>
          <span className="text-[11px] text-apple-text-secondary">
            {REPLY_LENGTH_INFO[replyLength].hint}
          </span>
        </div>
        <LengthSlider value={replyLength} onChange={setReplyLength} />
        <p className="mt-1 text-[10px] text-apple-text-secondary/60 flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <circle cx="6" cy="6" r="5" />
            <path d="M6 3.5v3M6 8v0.5" />
          </svg>
          越长的回复可能消耗更多 token
        </p>
      </div>

      {/* Who starts first */}
      <div className="mb-3">
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
