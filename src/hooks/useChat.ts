import { useState, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useChatStore } from '@/store/chatStore';
import {
  sendChatMessage,
  checkGrammarErrors,
  queryGrammar,
  AiResponseFormatError,
  AiNetworkError,
} from '@/services/ai';
import { buildChatSystemPrompt, buildGrammarCorrectionPrompt, buildGrammarSystemPrompt } from '@/utils/prompts';
import { getRoleById } from '@/data/roles';
import type { Message } from '@/types';

export function useChat() {
  const {
    apiConfig,
    sessions,
    currentSessionId,
    addMessage,
    updateMessage,
    openPanel,
    setGrammarQuery,
  } = useChatStore();

  const [isSending, setIsSending] = useState(false);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!currentSessionId || !apiConfig || !currentSession) return;

      // 1. Create user message
      const userMessage: Message = {
        id: nanoid(),
        sessionId: currentSessionId,
        role: 'user',
        content: text,
        timestamp: Date.now(),
        status: 'sent',
      };
      addMessage(currentSessionId, userMessage);

      // 2. Create placeholder AI message
      const aiMessageId = nanoid();
      const aiMessage: Message = {
        id: aiMessageId,
        sessionId: currentSessionId,
        role: 'ai',
        content: '',
        tokens: [],
        timestamp: Date.now(),
        status: 'sending',
      };
      addMessage(currentSessionId, aiMessage);

      setIsSending(true);

      try {
        // 1. Check grammar errors first (lightweight, fast feedback)
        try {
          const grammarErrors = await checkGrammarErrors(apiConfig, text);
          if (grammarErrors && grammarErrors.length > 0) {
            updateMessage(currentSessionId, userMessage.id, { grammarErrors });
          }
        } catch {
          // Grammar check is best-effort; don't fail the whole message if it errors
        }

        // 2. Generate AI dialogue response
        const role = getRoleById(currentSession.roleId);
        if (!role) throw new Error('Role not found');

        const systemPrompt = buildChatSystemPrompt(role, currentSession.difficulty);
        const history = currentSession.messages;

        const response = await sendChatMessage(apiConfig, systemPrompt, history, text);

        updateMessage(currentSessionId, aiMessageId, {
          content: response.message,
          tokens: response.tokens.map((t, i) => ({ text: t, index: i })),
          translation: response.translation,
          status: 'sent',
        });
      } catch (error) {
        const errorContent =
          error instanceof AiResponseFormatError
            ? 'AI 响应格式异常，请重试'
            : error instanceof AiNetworkError
              ? error.message
              : '发送失败，请重试';

        updateMessage(currentSessionId, aiMessageId, {
          status: 'error',
          content: errorContent,
        });
      } finally {
        setIsSending(false);
      }
    },
    [currentSessionId, apiConfig, currentSession, addMessage, updateMessage]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !apiConfig || !currentSession) return;

      // Find the failed AI message and the user message before it
      const messages = currentSession.messages;
      const failedIdx = messages.findIndex((m) => m.id === messageId);
      if (failedIdx <= 0) return;

      const userMessage = messages
        .slice(0, failedIdx)
        .reverse()
        .find((m) => m.role === 'user');
      if (!userMessage) return;

      // Reset the failed message to sending
      updateMessage(currentSessionId, messageId, {
        status: 'sending',
        content: '',
        tokens: [],
        translation: undefined,
      });

      setIsSending(true);

      try {
        // 1. Re-check grammar errors first
        try {
          const grammarErrors = await checkGrammarErrors(apiConfig, userMessage.content);
          if (grammarErrors && grammarErrors.length > 0) {
            updateMessage(currentSessionId, userMessage.id, { grammarErrors });
          }
        } catch {
          // Grammar check is best-effort
        }

        // 2. Generate AI dialogue response
        const role = getRoleById(currentSession.roleId);
        if (!role) throw new Error('Role not found');

        const systemPrompt = buildChatSystemPrompt(role, currentSession.difficulty);
        const history = messages.slice(0, failedIdx);

        const response = await sendChatMessage(apiConfig, systemPrompt, history, userMessage.content);

        updateMessage(currentSessionId, messageId, {
          content: response.message,
          tokens: response.tokens.map((t, i) => ({ text: t, index: i })),
          translation: response.translation,
          status: 'sent',
        });
      } catch (error) {
        updateMessage(currentSessionId, messageId, {
          status: 'error',
          content:
            error instanceof AiResponseFormatError
              ? 'AI 响应格式异常，请重试'
              : error instanceof AiNetworkError
                ? error.message
                : '重试失败，请再试一次',
        });
      } finally {
        setIsSending(false);
      }
    },
    [currentSessionId, apiConfig, currentSession, updateMessage]
  );

  const queryGrammarForSentence = useCallback(
    async (sentence: string, mode: 'query' | 'correction' = 'query') => {
      if (!apiConfig) return;

      setGrammarQuery({ sentence, mode, explanation: null, isLoading: true, error: null });
      openPanel('grammar', { type: 'grammar', sentence, mode });

      try {
        const systemPrompt =
          mode === 'correction'
            ? buildGrammarCorrectionPrompt(sentence)
            : buildGrammarSystemPrompt(sentence);
        const explanation = await queryGrammar(apiConfig, systemPrompt, sentence);
        setGrammarQuery({ explanation, isLoading: false, error: null });
      } catch (error) {
        setGrammarQuery({
          isLoading: false,
          error: error instanceof Error ? error.message : '查询失败，请重试',
        });
      }
    },
    [apiConfig, setGrammarQuery, openPanel]
  );

  return { sendMessage, retryMessage, queryGrammarForSentence, isSending };
}