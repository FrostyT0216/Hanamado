// ========== 角色与难度 ==========

export interface Role {
  id: string;
  name: string;
  nameJa: string;
  speechStyle: string;
  scenario: string;
  icon: string;
  /** 角色头像图片路径（位于 public/avatars/ 下，如 /avatars/konbini.png）。未提供时显示聊天气泡占位 */
  avatar?: string;
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

// ========== 消息与会话 ==========

export interface Token {
  text: string;
  index: number;
}

/** AI 返回的语法错误信息 */
export interface GrammarError {
  /** 错误在用户消息中的起始字符位置（从0开始） */
  start: number;
  /** 错误在用户消息中的结束字符位置（不包含，即 [start, end)） */
  end: number;
  /** 错误说明 */
  message: string;
  /** 建议的正确写法 */
  suggestion?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'ai';
  content: string;
  tokens?: Token[];
  translation?: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'error';
  /** AI 检测到的用户消息中的语法错误（仅 user 消息可能有） */
  grammarErrors?: GrammarError[];
}

export interface Session {
  id: string;
  title: string;
  roleId: string;
  difficulty: Difficulty;
  whoStartsFirst: 'user' | 'ai';
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ========== API 配置 ==========

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// ========== 词典 ==========

export interface DictEntry {
  word: string;
  reading: string;
  romaji: string;
  pos: string[];
  gloss: string[];
  examples?: string[];
}

// ========== AI 单词查询 ==========

export interface AiWordPos {
  term: string;        // 词性日文名，如 "自動詞（じどうし）"
  translation: string; // 词性中文翻译，如 "自动词"
}

export interface AiWordSentence {
  japanese: string;            // 日文例句
  chinese_translation: string; // 中文翻译
}

/** AI 返回的结构化单词查询结果 */
export interface AiWordEntry {
  dictionary_form: string;
  kana_form: string;
  romaji: string;
  pitch: string;
  parts_of_speech: AiWordPos[];
  definition: string;
  example_sentences: AiWordSentence[];
}

/** 本地 AI 收录中的持久化条目 */
export interface LocalAiEntry {
  word: string;              // 原始查询词（查找键）
  dictionary_form: string;
  kana_form: string;
  romaji: string;
  pitch: string;
  parts_of_speech: AiWordPos[];
  definition: string;
  example_sentences: AiWordSentence[];
  savedAt: number;           // Date.now() 时间戳
}

// ========== 面板 ==========

export type PanelMode = 'dict' | 'grammar' | null;

export type PanelData =
  | { type: 'dict'; word: string; token: Token }
  | { type: 'grammar'; sentence: string; mode?: 'query' | 'correction' }
  | null;

// ========== 主题 ==========

export type Theme = 'light' | 'dark';

// ========== 外观个性化 ==========

export type FontSize = 'compact' | 'standard' | 'comfortable';
export type GlassBlur = 'off' | 'soft' | 'standard' | 'strong';
export type BubbleRadius = 'sharp' | 'standard' | 'soft';
/** 背景装饰：纯图案叠加层 */
export type BackgroundDecoration = 'none' | 'dots' | 'grid' | 'glow';
/** 背景图片：纯色（无图）/ 自定义图片 / 必应随机壁纸 */
export type BackgroundImage = 'solid' | 'image' | 'bing';
export type MotionLevel = 'off' | 'reduced' | 'standard';
export type BubbleStyle = 'solid' | 'glass' | 'liquid';

export interface AppearanceSettings {
  fontSize: FontSize;
  glassBlur: GlassBlur;
  bubbleRadius: BubbleRadius;
  backgroundDecoration: BackgroundDecoration;
  backgroundImage: BackgroundImage;
  motionLevel: MotionLevel;
  backgroundImageUrl: string;
  bubbleStyle: BubbleStyle;
}

// ========== 语法查询状态 ==========

export interface GrammarQueryState {
  sentence: string;
  explanation: string | null;
  isLoading: boolean;
  error: string | null;
  mode: 'query' | 'correction';
}

// ========== 词汇库 ==========

export type VocabLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

export interface VocabSentence {
  kanji: string;
  furigana: string;
  translation: string;
}

export interface VocabEntry {
  id: string;
  kanji: string;
  furigana: string;
  pitch: string;
  pos: string;
  definition: string;
  notes: string;
  sentences: VocabSentence[];
  level: VocabLevel;
}

export interface VocabIndex {
  levels: Record<VocabLevel, {
    count: number;
    file: string;
  }>;
}

// ========== 背单词与间隔复习 ==========

/** 单词学习状态 */
export type WordStatus = 'new' | 'learning' | 'mastered';

/** 单个词的学习进度 */
export interface WordProgress {
  wordId: string;              // JLPT 用 entry.id（UUID），AI 收录用 "ai:食べる"
  source: 'jlpt' | 'ai';
  level?: VocabLevel;          // 仅 jlpt 来源有
  status: WordStatus;
  currentStage: number;        // 0=刚学完待第1次复习；1..5=已通过几次复习；5=已掌握
  learnedAt: number;           // 首次学习时间戳
  nextReviewAt: number;        // 下次到期时间戳（0 表示已掌握/无待复习）
  lastReviewAt: number;        // 上次复习时间戳
  reviewHistory: ReviewRecord[];
}

/** 单次复习记录 */
export interface ReviewRecord {
  reviewedAt: number;          // 时间戳
  stage: number;               // 当时的 stage
  passed: boolean;
  correctCount: number;
  totalCount: number;
}

/** 一批学习词（一次「开始学习新词」产生一个 batch） */
export interface LearningBatch {
  id: string;                  // 时间戳生成的唯一 id
  createdAt: number;
  source: 'jlpt' | 'ai';
  level?: VocabLevel;
  wordIds: string[];
  size: number;
}

/** 复习间隔表（天数）：索引 i 表示「第 i+1 次复习距上次的间隔」 */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 15, 30] as const;
/** 总复习次数 */
export const TOTAL_REVIEW_STAGES = REVIEW_INTERVALS_DAYS.length; // 5

/** AI 返回的复习题目结构 */
export interface ReviewQuestion {
  type: 'reading' | 'kanji' | 'fillblank' | 'usage';
  prompt: string;              // 题干
  stem: string;                // 题干主体（汉字/词/例句）
  options: string[];           // 4 个选项
  answer: number;              // 正确选项索引 0-3
  explanation: string;         // 解析
}

export interface AiReviewQuiz {
  word: string;
  questions: ReviewQuestion[];
}

/** 学习设置 */
export interface LearningSettings {
  batchSize: number;           // 每次背词数量
  dailyNewWordLimit: number;   // 每日新词上限
  source: 'jlpt' | 'ai' | 'favorite';
  selectedLevel: VocabLevel;
}

// ========== 听写 ==========

/** 听写词源：学习中 / 已掌握 / 自定义列表（收藏夹 + AI 收录） */
export type DictationSource = 'learning' | 'mastered' | 'custom';

/** 听写设置（持久化） */
export interface DictationSettings {
  source: DictationSource;
  batchSize: number;
  /** 是否在进入新词时自动播放音频 */
  autoPlayAudio: boolean;
}

/** 单词听写作答记录 */
export interface DictationResultRecord {
  wordId: string;
  source: 'jlpt' | 'ai';
  expected: string;           // 期望文本（kanji/kana）
  actual: string;             // 用户实际输入
  correct: boolean;
  durationMs: number;
}

/** 听写会话结果摘要 */
export interface DictationSummary {
  total: number;
  correct: number;
  results: DictationResultRecord[];
  durationMs: number;
}