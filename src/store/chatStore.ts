import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Session,
  Message,
  ApiConfig,
  Difficulty,
  ReplyLength,
  PanelMode,
  PanelData,
  Theme,
  GrammarQueryState,
  AppearanceSettings,
  FontSize,
  GlassBlur,
  BubbleRadius,
  BackgroundDecoration,
  BackgroundImage,
  MotionLevel,
  BubbleStyle,
} from '@/types';
import { encryptedStorage } from '@/services/storage';
import { getRoleById } from '@/data/roles';

/** Only these fields are persisted to localStorage */
type PersistedState = Pick<
  ChatState,
  | 'sessions'
  | 'currentSessionId'
  | 'apiConfig'
  | 'theme'
  | 'accentColor'
  | 'fontSize'
  | 'glassBlur'
  | 'bubbleRadius'
  | 'backgroundDecoration'
  | 'backgroundImage'
  | 'motionLevel'
  | 'backgroundImageUrl'
  | 'bingImageUrl'
  | 'bubbleStyle'
  | 'knowledgePanelWidth'
  | 'balanceWarningThreshold'
>;

interface ChatState {
  // Data
  sessions: Session[];
  currentSessionId: string | null;
  apiConfig: ApiConfig | null;

  // UI
  theme: Theme;
  panelMode: PanelMode;
  panelData: PanelData;
  isNewChatDialogOpen: boolean;
  isSettingsOpen: boolean;
  isSidebarOpen: boolean;
  isLearnPlanOpen: boolean;
  isFlashcardOpen: boolean;
  accentColor: string;
  fontSize: FontSize;
  glassBlur: GlassBlur;
  bubbleRadius: BubbleRadius;
  backgroundDecoration: BackgroundDecoration;
  backgroundImage: BackgroundImage;
  motionLevel: MotionLevel;
  backgroundImageUrl: string;
  bingImageUrl: string;
  bubbleStyle: BubbleStyle;
  knowledgePanelWidth: number;
  balanceWarningThreshold: number;
  grammarQuery: GrammarQueryState;

  // Computed (via getters)
  getCurrentSession: () => Session | undefined;
  getCurrentMessages: () => Message[];

  // Actions
  createSession: (roleId: string, difficulty: Difficulty, whoStartsFirst: 'user' | 'ai', replyLength?: ReplyLength) => string;
  deleteSession: (sessionId: string) => void;
  switchSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setApiConfig: (config: ApiConfig) => void;
  openPanel: (mode: PanelMode, data: PanelData) => void;
  closePanel: () => void;
  setNewChatDialogOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setLearnPlanOpen: (open: boolean) => void;
  setFlashcardOpen: (open: boolean) => void;
  closeAllOverlays: () => void;
  toggleSidebar: () => void;
  setAccentColor: (color: string) => void;
  setAppearance: (patch: Partial<AppearanceSettings>) => void;
  setBingImageUrl: (url: string) => void;
  setKnowledgePanelWidth: (width: number) => void;
  toggleTheme: () => void;
  setGrammarQuery: (state: Partial<GrammarQueryState>) => void;
  setBalanceWarningThreshold: (threshold: number) => void;
}

export const useChatStore = create<ChatState>()(
  persist<ChatState, [], [], PersistedState>(
    (set, get) => ({
      // Data
      sessions: [],
      currentSessionId: null,
      apiConfig: null,

      // UI
      theme: 'light',
      panelMode: null,
      panelData: null,
      isNewChatDialogOpen: false,
      isSettingsOpen: false,
      isSidebarOpen: false,
      isLearnPlanOpen: false,
      isFlashcardOpen: false,
      accentColor: '#007aff',
      fontSize: 'standard',
      glassBlur: 'standard',
      bubbleRadius: 'standard',
      backgroundDecoration: 'none',
      backgroundImage: 'solid',
      motionLevel: 'standard',
      backgroundImageUrl: '',
      bingImageUrl: '',
      bubbleStyle: 'solid',
      knowledgePanelWidth: 360,
      balanceWarningThreshold: 10,
      grammarQuery: {
        sentence: '',
        explanation: null,
        isLoading: false,
        error: null,
        mode: 'query',
      },

      // Computed
      getCurrentSession: () => {
        const { sessions, currentSessionId } = get();
        return sessions.find((s) => s.id === currentSessionId);
      },
      getCurrentMessages: () => {
        const session = get().getCurrentSession();
        return session?.messages ?? [];
      },

      // Actions
      createSession: (roleId, difficulty, whoStartsFirst, replyLength) => {
        const role = getRoleById(roleId);
        const id = nanoid();
        const now = Date.now();
        const session: Session = {
          id,
          title: role ? `${role.icon} ${role.name}` : '新会话',
          roleId,
          difficulty,
          replyLength,
          whoStartsFirst,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: id,
        }));
        return id;
      },

      deleteSession: (sessionId) => {
        set((state) => {
          const sessions = state.sessions.filter((s) => s.id !== sessionId);
          const currentSessionId =
            state.currentSessionId === sessionId
              ? sessions[0]?.id ?? null
              : state.currentSessionId;
          return { sessions, currentSessionId };
        });
      },

      switchSession: (sessionId) => {
        set({
          currentSessionId: sessionId,
          isSidebarOpen: false,
          isSettingsOpen: false,
          isLearnPlanOpen: false,
          isFlashcardOpen: false,
        });
      },

      addMessage: (sessionId, message) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
              : s
          ),
        }));
      },

      updateMessage: (sessionId, messageId, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === messageId ? { ...m, ...updates } : m
                  ),
                  updatedAt: Date.now(),
                }
              : s
          ),
        }));
      },

      setApiConfig: (config) => {
        set({ apiConfig: config });
      },

      openPanel: (mode, data) => {
        set({ panelMode: mode, panelData: data });
      },

      closePanel: () => {
        set({ panelMode: null, panelData: null });
      },

      setNewChatDialogOpen: (open) => set({ isNewChatDialogOpen: open }),
      setSettingsOpen: (open) =>
        set(open
          ? { isSettingsOpen: true, isLearnPlanOpen: false, isFlashcardOpen: false }
          : { isSettingsOpen: false }),
      setLearnPlanOpen: (open) =>
        set(open
          ? { isLearnPlanOpen: true, isSettingsOpen: false, isFlashcardOpen: false }
          : { isLearnPlanOpen: false }),
      setFlashcardOpen: (open) =>
        set(open
          ? { isFlashcardOpen: true, isSettingsOpen: false, isLearnPlanOpen: false }
          : { isFlashcardOpen: false }),
      closeAllOverlays: () =>
        set({ isSettingsOpen: false, isLearnPlanOpen: false, isFlashcardOpen: false }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setAccentColor: (color) => set({ accentColor: color }),

      setAppearance: (patch) => set((state) => ({ ...state, ...patch })),

      setBingImageUrl: (url) => set({ bingImageUrl: url }),
      setKnowledgePanelWidth: (width) => set({ knowledgePanelWidth: width }),

      toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' }));
      },

      setGrammarQuery: (partial) => {
        set((state) => ({
          grammarQuery: { ...state.grammarQuery, ...partial },
        }));
      },

      setBalanceWarningThreshold: (threshold) => {
        set({ balanceWarningThreshold: Math.max(0, threshold) });
      },
    }),
    {
      name: 'hanamado-store',
      storage: createJSONStorage(() => encryptedStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        apiConfig: state.apiConfig,
        theme: state.theme,
        accentColor: state.accentColor,
        fontSize: state.fontSize,
        glassBlur: state.glassBlur,
        bubbleRadius: state.bubbleRadius,
        backgroundDecoration: state.backgroundDecoration,
        backgroundImage: state.backgroundImage,
        motionLevel: state.motionLevel,
        backgroundImageUrl: state.backgroundImageUrl,
        bingImageUrl: state.bingImageUrl,
        bubbleStyle: state.bubbleStyle,
        knowledgePanelWidth: state.knowledgePanelWidth,
        balanceWarningThreshold: state.balanceWarningThreshold,
      }),
      // 旧版用单一 backgroundPattern 字段，迁移到 decoration + image 两个独立字段
      migrate: (persisted: unknown): PersistedState => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        const oldPattern = s.backgroundPattern as string | undefined;
        if (oldPattern && s.backgroundDecoration === undefined && s.backgroundImage === undefined) {
          if (oldPattern === 'solid' || oldPattern === 'image' || oldPattern === 'bing') {
            s.backgroundDecoration = 'none';
            s.backgroundImage = oldPattern;
          } else if (oldPattern === 'dots' || oldPattern === 'grid' || oldPattern === 'glow') {
            s.backgroundDecoration = oldPattern;
            s.backgroundImage = 'solid';
          }
          delete s.backgroundPattern;
        }
        return s as PersistedState;
      },
      version: 2,
    }
  )
);