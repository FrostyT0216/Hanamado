import { decrypt, encrypt } from '@/utils/encryption';
import type {
  ApiConfig,
  AppearanceSettings,
  DictationSettings,
  LearningBatch,
  LearningSettings,
  LocalAiEntry,
  Session,
  Theme,
  WordProgress,
} from '@/types';

/** 数据类别：可单独选择导出/导入 */
export type DataCategory =
  | 'chat' // 聊天记录
  | 'api' // API 配置（含密钥）
  | 'appearance' // 个性化设置
  | 'aiVocab' // AI 收录词库
  | 'learning' // 背词/复习进度
  | 'dictation'; // 听写设置

export const CATEGORY_LABELS: Record<DataCategory, string> = {
  chat: '聊天记录',
  api: 'API 配置',
  appearance: '个性化设置',
  aiVocab: 'AI 收录词库',
  learning: '背词与复习进度',
  dictation: '听写设置',
};

export const CATEGORY_DESCRIPTIONS: Record<DataCategory, string> = {
  chat: '全部会话及其消息记录',
  api: '服务商地址、模型、API Key（明文）',
  appearance: '主题、颜色、字体、背景、动效等',
  aiVocab: '通过 AI 查询后收藏的单词',
  learning: '单词学习状态、复习进度、批次记录',
  dictation: '听写词源、批量数等偏好',
};

export const ALL_CATEGORIES: DataCategory[] = [
  'chat',
  'api',
  'appearance',
  'aiVocab',
  'learning',
  'dictation',
];

const STORAGE_KEYS = {
  chatStore: 'hanamado-store',
  vocabProgress: 'hanamado-vocab-progress',
  wordLearning: 'hanamado-word-learning',
  dictation: 'hanamado-dictation',
  aiWordCollection: 'hanamado-ai-word-collection',
} as const;

const BACKUP_VERSION = 1;

export interface BackupAppearance
  extends Partial<AppearanceSettings> {
  theme?: Theme;
  accentColor?: string;
  bingImageUrl?: string;
  knowledgePanelWidth?: number;
  balanceWarningThreshold?: number;
}

export interface BackupPayload {
  meta: {
    app: 'hanamado';
    version: number;
    exportedAt: number;
    categories: DataCategory[];
    sizeBytes?: number;
  };
  data: {
    sessions?: Session[];
    currentSessionId?: string | null;
    apiConfig?: ApiConfig | null;
    appearance?: BackupAppearance;
    aiWordCollection?: Record<string, LocalAiEntry>;
    vocabProgress?: {
      learnedWords: string[];
      totalReviews: number;
      favoriteIds: string[];
      panelWidth: number;
    };
    wordLearning?: {
      wordProgress: Record<string, WordProgress>;
      batches: LearningBatch[];
      settings: LearningSettings;
    };
    dictationSettings?: DictationSettings;
  };
}

interface ChatStoreShape {
  state: Record<string, unknown> & {
    sessions?: Session[];
    currentSessionId?: string | null;
    apiConfig?: ApiConfig | null;
    theme?: Theme;
    accentColor?: string;
    fontSize?: string;
    glassBlur?: string;
    bubbleRadius?: string;
    backgroundDecoration?: string;
    backgroundImage?: string;
    motionLevel?: string;
    backgroundImageUrl?: string;
    bingImageUrl?: string;
    bubbleStyle?: string;
    knowledgePanelWidth?: number;
    balanceWarningThreshold?: number;
  };
  version?: number;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** 读取 chatStore 并解密 apiKey */
function loadChatStore(): ChatStoreShape | null {
  const parsed = readJson<ChatStoreShape>(STORAGE_KEYS.chatStore);
  if (!parsed) return null;
  if (parsed.state?.apiConfig?.apiKey) {
    try {
      parsed.state.apiConfig.apiKey = decrypt(parsed.state.apiConfig.apiKey);
    } catch {
      // 解密失败保留原值
    }
  }
  return parsed;
}

/** 导出数据：根据选定的类别生成备份对象 */
export function exportData(categories: DataCategory[]): BackupPayload {
  const chatStore = loadChatStore();
  const payload: BackupPayload = {
    meta: {
      app: 'hanamado',
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      categories,
    },
    data: {},
  };

  if (categories.includes('chat')) {
    payload.data.sessions = chatStore?.state?.sessions ?? [];
    payload.data.currentSessionId = chatStore?.state?.currentSessionId ?? null;
  }
  if (categories.includes('api')) {
    payload.data.apiConfig = chatStore?.state?.apiConfig ?? null;
  }
  if (categories.includes('appearance')) {
    const s = chatStore?.state;
    if (s) {
      payload.data.appearance = {
        theme: s.theme,
        accentColor: s.accentColor,
        fontSize: s.fontSize as AppearanceSettings['fontSize'],
        glassBlur: s.glassBlur as AppearanceSettings['glassBlur'],
        bubbleRadius: s.bubbleRadius as AppearanceSettings['bubbleRadius'],
        backgroundDecoration:
          s.backgroundDecoration as AppearanceSettings['backgroundDecoration'],
        backgroundImage: s.backgroundImage as AppearanceSettings['backgroundImage'],
        motionLevel: s.motionLevel as AppearanceSettings['motionLevel'],
        backgroundImageUrl: s.backgroundImageUrl,
        bingImageUrl: s.bingImageUrl,
        bubbleStyle: s.bubbleStyle as AppearanceSettings['bubbleStyle'],
        knowledgePanelWidth: s.knowledgePanelWidth,
        balanceWarningThreshold: s.balanceWarningThreshold,
      };
    }
  }
  if (categories.includes('aiVocab')) {
    payload.data.aiWordCollection =
      readJson<Record<string, LocalAiEntry>>(STORAGE_KEYS.aiWordCollection) ?? {};
  }
  if (categories.includes('learning')) {
    const vocab = readJson<{ state: BackupPayload['data']['vocabProgress'] }>(
      STORAGE_KEYS.vocabProgress
    );
    payload.data.vocabProgress = vocab?.state ?? undefined;
    const learning = readJson<{ state: BackupPayload['data']['wordLearning'] }>(
      STORAGE_KEYS.wordLearning
    );
    payload.data.wordLearning = learning?.state ?? undefined;
  }
  if (categories.includes('dictation')) {
    const dict = readJson<{ state: { settings: DictationSettings } }>(
      STORAGE_KEYS.dictation
    );
    payload.data.dictationSettings = dict?.state?.settings ?? undefined;
  }

  payload.meta.sizeBytes = new Blob([JSON.stringify(payload)]).size;
  return payload;
}

/** 解析备份文件内容，校验合法性 */
export function parseBackupFile(text: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON 格式');
  }
  const p = parsed as Partial<BackupPayload>;
  if (!p || p.meta?.app !== 'hanamado') {
    throw new Error('不是有效的話窓备份文件');
  }
  if (typeof p.meta?.version !== 'number') {
    throw new Error('备份文件版本信息缺失');
  }
  if (!p.data || typeof p.data !== 'object') {
    throw new Error('备份数据结构损坏');
  }
  return p as BackupPayload;
}

export interface ImportSummary {
  /** 备份文件中实际包含的类别 */
  availableCategories: DataCategory[];
  sessionsCount: number;
  aiVocabCount: number;
  hasApiConfig: boolean;
  exportedAt: number | null;
  sizeBytes: number;
  /** 备份文件中声明的类别（可能与实际包含的不一致） */
  declaredCategories: DataCategory[];
}

/** 检测备份文件中实际包含哪些类别的数据 */
export function getAvailableCategories(payload: BackupPayload): DataCategory[] {
  const present: DataCategory[] = [];
  if (payload.data.sessions !== undefined) present.push('chat');
  if (payload.data.apiConfig !== undefined) present.push('api');
  if (payload.data.appearance !== undefined) present.push('appearance');
  if (payload.data.aiWordCollection !== undefined) present.push('aiVocab');
  if (
    payload.data.vocabProgress !== undefined ||
    payload.data.wordLearning !== undefined
  )
    present.push('learning');
  if (payload.data.dictationSettings !== undefined) present.push('dictation');
  return present;
}

export function summarizeBackup(payload: BackupPayload): ImportSummary {
  return {
    availableCategories: getAvailableCategories(payload),
    sessionsCount: payload.data.sessions?.length ?? 0,
    aiVocabCount: payload.data.aiWordCollection
      ? Object.keys(payload.data.aiWordCollection).length
      : 0,
    hasApiConfig: Boolean(payload.data.apiConfig?.apiKey),
    exportedAt: payload.meta.exportedAt ?? null,
    sizeBytes:
      payload.meta.sizeBytes ?? new Blob([JSON.stringify(payload)]).size,
    declaredCategories: payload.meta.categories ?? [],
  };
}

/** 应用导入：将选定的类别合并/覆盖到 localStorage */
export function applyImport(
  payload: BackupPayload,
  categories: DataCategory[]
): void {
  // 更新 chatStore（包含 sessions/apiConfig/appearance）
  const needsChatStoreUpdate = categories.some((c) =>
    ['chat', 'api', 'appearance'].includes(c)
  );
  if (needsChatStoreUpdate) {
    const existing =
      readJson<ChatStoreShape>(STORAGE_KEYS.chatStore) ?? {
        state: {},
        version: 2,
      };
    if (categories.includes('chat') && payload.data.sessions !== undefined) {
      existing.state.sessions = payload.data.sessions;
      existing.state.currentSessionId = payload.data.currentSessionId ?? null;
    }
    if (categories.includes('api') && payload.data.apiConfig !== undefined) {
      // 写入前需要对 apiKey 进行加密（与 encryptedStorage adapter 行为一致）
      const cfg = payload.data.apiConfig;
      existing.state.apiConfig = cfg
        ? {
            ...cfg,
            apiKey: cfg.apiKey ? encrypt(cfg.apiKey) : cfg.apiKey,
          }
        : null;
    }
    if (categories.includes('appearance') && payload.data.appearance) {
      Object.assign(existing.state, payload.data.appearance);
    }
    localStorage.setItem(STORAGE_KEYS.chatStore, JSON.stringify(existing));
  }

  // 更新 AI 收录词库（直接覆盖）
  if (
    categories.includes('aiVocab') &&
    payload.data.aiWordCollection !== undefined
  ) {
    localStorage.setItem(
      STORAGE_KEYS.aiWordCollection,
      JSON.stringify(payload.data.aiWordCollection)
    );
  }

  // 更新词汇进度
  if (categories.includes('learning')) {
    if (payload.data.vocabProgress !== undefined) {
      const existing =
        readJson<{ state: unknown; version: number }>(
          STORAGE_KEYS.vocabProgress
        ) ?? { state: {}, version: 0 };
      existing.state = payload.data.vocabProgress;
      localStorage.setItem(
        STORAGE_KEYS.vocabProgress,
        JSON.stringify(existing)
      );
    }
    if (payload.data.wordLearning !== undefined) {
      const existing =
        readJson<{ state: unknown; version: number }>(
          STORAGE_KEYS.wordLearning
        ) ?? { state: {}, version: 0 };
      existing.state = payload.data.wordLearning;
      localStorage.setItem(
        STORAGE_KEYS.wordLearning,
        JSON.stringify(existing)
      );
    }
  }

  // 更新听写设置
  if (
    categories.includes('dictation') &&
    payload.data.dictationSettings !== undefined
  ) {
    const existing =
      readJson<{ state: { settings: DictationSettings }; version: number }>(
        STORAGE_KEYS.dictation
      ) ?? { state: { settings: payload.data.dictationSettings }, version: 0 };
    existing.state.settings = payload.data.dictationSettings;
    localStorage.setItem(STORAGE_KEYS.dictation, JSON.stringify(existing));
  }
}

/** 触发文件下载 */
export function downloadBackup(payload: BackupPayload): void {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const a = document.createElement('a');
  a.href = url;
  a.download = `hanamado-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 格式化字节数 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 格式化时间戳为本地时间 */
export function formatExportTime(ts: number): string {
  try {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  } catch {
    return '未知时间';
  }
}
