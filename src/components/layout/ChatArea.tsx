import { useRef, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import type { Token } from '@/types';
import { useChat } from '@/hooks/useChat';
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import GrammarMenu from '@/components/chat/GrammarMenu';
import EmptyState from '@/components/chat/EmptyState';
import { useTextSelection } from '@/hooks/useTextSelection';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import GameIcon from '@/components/common/GameIcon';
import RoleAvatar from '@/components/common/RoleAvatar';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import { getRoleById, DIFFICULTY_LABELS } from '@/data/roles';
import { formatRelativeTime } from '@/utils/timeFormat';

const difficultyColors: Record<string, string> = {
  beginner: 'bg-difficulty-beginner/10 text-difficulty-beginner',
  intermediate: 'bg-difficulty-intermediate/10 text-difficulty-intermediate',
  advanced: 'bg-difficulty-advanced/10 text-difficulty-advanced',
};

export default function ChatArea() {
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const apiConfig = useChatStore((s) => s.apiConfig);
  const openPanel = useChatStore((s) => s.openPanel);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);

  const { sendMessage, retryMessage, queryGrammarForSentence, isSending } = useChat();

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const messages = currentSession?.messages ?? [];
  const role = currentSession ? getRoleById(currentSession.roleId) : undefined;
  const messageCount = messages.filter((m) => m.status !== 'sending').length;
  const containerRef = useRef<HTMLDivElement>(null);
  const { selectedText, selectionRect, clearSelection, handleMouseUp } = useTextSelection(containerRef);

  useAutoScroll(containerRef, [messages.length, messages[messages.length - 1]?.status]);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const handleTokenClick = (token: Token) => {
    openPanel('dict', { type: 'dict', word: token.text, token });
  };

  const handleGrammarQuery = (sentence: string) => {
    queryGrammarForSentence(sentence, 'query');
    clearSelection();
  };

  const handleCopy = async (text: string) => {
    // Collapse whitespace/newlines from multi-element selections into a single clean line
    const cleaned = text.replace(/\s+/g, ' ').trim();
    try {
      await navigator.clipboard.writeText(cleaned);
    } catch (err) {
      console.error('复制失败:', err);
      // Fallback: copy via a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = cleaned;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
    clearSelection();
  };

  const handleGrammarCorrect = (sentence: string) => {
    queryGrammarForSentence(sentence, 'correction');
  };

  const handleRetry = (messageId: string) => {
    retryMessage(messageId);
  };

  if (!currentSession) {
    return (
      <div className="h-full flex flex-col">
        <div className="md:hidden flex items-center px-4 py-2 border-b border-black/5 dark:border-white/5">
          <button onClick={toggleSidebar} className="p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
            <GameIcon name="menu" className="w-[18px] h-[18px]" />
          </button>
          <h1 className="text-sm font-semibold ml-2">話窓</h1>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" onMouseUp={handleMouseUp}>
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 md:px-5 py-3 border-b border-black/5 dark:border-white/5 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
        >
          <GameIcon name="menu" className="w-[18px] h-[18px]" />
        </button>

        {role && currentSession ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <RoleAvatar role={role} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold truncate">{role.name}</h1>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${difficultyColors[currentSession.difficulty] ?? ''}`}
                >
                  {DIFFICULTY_LABELS[currentSession.difficulty] ?? currentSession.difficulty}
                </span>
              </div>
              <p className="text-[11px] text-apple-text-secondary">
                已聊 {messageCount} 句 · {formatRelativeTime(currentSession.updatedAt)}
              </p>
            </div>
          </div>
        ) : (
          <h1 className="text-sm font-semibold">話窓</h1>
        )}
      </div>

      {/* API not configured banner */}
      {!apiConfig && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-sm">
          <GameIcon name="warning" className="w-4 h-4" />
          <span className="text-amber-800 dark:text-amber-200">请先配置 API 连接</span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="ml-auto text-xs font-medium text-amber-700 dark:text-amber-300 underline hover:no-underline"
          >
            去配置
          </button>
        </div>
      )}

      {/* Messages area */}
      <CustomScrollbar
        ref={containerRef}
        className="flex-1"
        viewportClassName="px-4 py-4"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                role={role}
                onTokenClick={handleTokenClick}
                onRetry={msg.status === 'error' && msg.role === 'ai' ? () => handleRetry(msg.id) : undefined}
                onGrammarCorrect={handleGrammarCorrect}
              />
            ))}
          </div>
        )}
      </CustomScrollbar>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSend} disabled={isSending || !apiConfig} />
        </div>
      </div>

      {/* Grammar floating menu */}
      {selectedText && selectionRect && (
        <GrammarMenu
          selectedText={selectedText}
          position={{ x: selectionRect.left + selectionRect.width / 2, y: selectionRect.top }}
          onQuery={handleGrammarQuery}
          onCopy={handleCopy}
          onClose={clearSelection}
        />
      )}
    </div>
  );
}