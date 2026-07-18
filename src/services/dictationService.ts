// 听写词源与词条解析工具
import type { DictationSource, VocabLevel } from '@/types';
import {
  getEntryById,
  loadLevel,
  findLevelById,
  isLevelReady,
} from './vocabService';
import { getAiEntry, loadAiCollection } from './aiWordStorage';
import { useLearningStore } from '@/store/learningStore';
import { useVocabStore } from '@/store/vocabStore';

/** 统一的听写词条视图 */
export interface DictationWordView {
  wordId: string;
  source: 'jlpt' | 'ai';
  /** 期望用户写出的文本（默认 kanji 形式；纯假名词则为假名） */
  expected: string;
  /** 假名形式（用于语音合成） */
  kana: string;
  /** 中文翻译（用于顶部展示） */
  meaning: string;
  /** 词性（用于显示，可空） */
  pos?: string;
}

/** 通过 wordId 解析为听写视图 */
export function resolveDictationWord(wordId: string): DictationWordView | null {
  if (wordId.startsWith('ai:')) {
    const word = wordId.slice(3);
    const entry = getAiEntry(word);
    if (!entry) return null;
    return {
      wordId,
      source: 'ai',
      expected: entry.dictionary_form || word,
      kana: entry.kana_form || entry.romaji || word,
      meaning: entry.definition || '',
      pos: entry.parts_of_speech?.[0]?.translation,
    };
  }
  // JLPT UUID
  const entry = getEntryById(wordId);
  if (!entry) return null;
  return {
    wordId,
    source: 'jlpt',
    expected: entry.kanji || entry.furigana,
    kana: entry.furigana || entry.kanji,
    meaning: entry.definition || '',
    pos: entry.pos || undefined,
  };
}

/** 抽取听写候选 wordIds（Fisher-Yates 打乱后取前 N 个） */
export function pickDictationCandidates(
  source: DictationSource,
  batchSize: number
): string[] {
  const candidates = collectCandidateIds(source);
  if (candidates.length === 0) return [];

  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(batchSize, shuffled.length));
}

function collectCandidateIds(source: DictationSource): string[] {
  const wordProgress = useLearningStore.getState().wordProgress;

  switch (source) {
    case 'learning': {
      return Object.values(wordProgress)
        .filter((p) => p.status === 'learning')
        .map((p) => p.wordId);
    }
    case 'mastered': {
      return Object.values(wordProgress)
        .filter((p) => p.status === 'mastered')
        .map((p) => p.wordId);
    }
    case 'custom': {
      // 收藏夹 + AI 收录（去重）
      const favoriteIds = useVocabStore.getState().favoriteIds;
      const aiCollection = loadAiCollection();
      const aiIds = Object.values(aiCollection).map((e) => `ai:${e.word}`);
      const set = new Set<string>([...favoriteIds, ...aiIds]);
      return Array.from(set);
    }
    default:
      return [];
  }
}

/**
 * 确保给定的 wordIds 都能被 resolveDictationWord 解析。
 * 对于 JLPT UUIDs，若 level 数据未加载，会先加载对应 level。
 * AI 词（ai: 前缀）从 localStorage 读取，无需加载。
 */
export async function ensureWordsResolvable(wordIds: string[]): Promise<void> {
  // 筛选出尚未能解析的 JLPT wordIds
  const unresolvedJlpt = wordIds.filter(
    (id) => !id.startsWith('ai:') && !getEntryById(id)
  );
  if (unresolvedJlpt.length === 0) return;

  const wordProgress = useLearningStore.getState().wordProgress;
  const levelsToLoad = new Set<VocabLevel>();
  const needReverseLookup: string[] = [];

  // 1. 优先从 wordProgress[level] 获取 level
  for (const id of unresolvedJlpt) {
    const level = wordProgress[id]?.level;
    if (level && !isLevelReady(level)) {
      levelsToLoad.add(level);
    } else if (!level) {
      needReverseLookup.push(id);
    }
  }

  // 2. 对没有 level 信息的词，通过 search index 反查 level
  if (needReverseLookup.length > 0) {
    for (const id of needReverseLookup) {
      const level = await findLevelById(id);
      if (level && !isLevelReady(level)) {
        levelsToLoad.add(level);
      }
    }
  }

  // 3. 并行加载所有需要的 level（已加载的会被 loadLevel 跳过）
  await Promise.all(
    Array.from(levelsToLoad).map((level) =>
      loadLevel(level).catch((e) => {
        console.warn(`[dictation] 加载 level ${level} 失败:`, e);
      })
    )
  );
}

/**
 * 列出某个词源下所有候选单词的视图（用于单词列表选择器）。
 * 会先确保所有词都能解析（必要时加载 level 数据）。
 */
export async function listDictationCandidates(
  source: DictationSource
): Promise<DictationWordView[]> {
  const ids = collectCandidateIds(source);
  if (ids.length === 0) return [];
  await ensureWordsResolvable(ids);
  const views: DictationWordView[] = [];
  for (const id of ids) {
    const view = resolveDictationWord(id);
    if (view) views.push(view);
  }
  return views;
}

// ============ 输入校验：支持汉字/假名混合 ============

/** 判断字符是否为假名（平假名或片假名） */
function isKanaChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x3040 && code <= 0x309f) || // 平假名
    (code >= 0x30a0 && code <= 0x30ff)    // 片假名
  );
}

/**
 * 对齐 expected（可能含汉字）和 kana（纯假名），得到每个 expected 字符的假名读音。
 * 算法：遍历 expected，假名字符 1:1 配对；汉字字符收集 kana 直到遇到 expected 中下一个假名。
 * 连续汉字时，第一个汉字收集所有剩余 reading，其余汉字 reading 为空。
 */
function alignExpectedKana(
  expected: string,
  kana: string
): { char: string; reading: string }[] {
  const result: { char: string; reading: string }[] = [];
  let kanaIdx = 0;
  for (let i = 0; i < expected.length; i++) {
    const ch = expected[i];
    if (isKanaChar(ch)) {
      if (kanaIdx < kana.length && kana[kanaIdx] === ch) {
        result.push({ char: ch, reading: ch });
        kanaIdx++;
      } else {
        result.push({ char: ch, reading: ch });
      }
    } else {
      // 汉字：找 expected 中下一个假名作为停止标记
      let nextExpectedKana = '';
      for (let j = i + 1; j < expected.length; j++) {
        if (isKanaChar(expected[j])) {
          nextExpectedKana = expected[j];
          break;
        }
      }
      // 收集 kana 直到遇到 nextExpectedKana 或 kana 耗尽
      let reading = '';
      while (kanaIdx < kana.length) {
        if (nextExpectedKana && kana[kanaIdx] === nextExpectedKana) break;
        reading += kana[kanaIdx];
        kanaIdx++;
      }
      result.push({ char: ch, reading });
    }
  }
  return result;
}

/**
 * 将输入文本转换为假名形式。
 * 利用 expected→kana 的对齐信息，把用户输入的汉字替换为对应的假名读音。
 * 未知汉字（不在 expected 中的）保留原字符，通常会导致后续比较失败。
 */
function toKanaForm(input: string, expected: string, kana: string): string {
  const align = alignExpectedKana(expected, kana);
  // 建立汉字→reading 映射（首次出现为准）
  const charMap = new Map<string, string>();
  for (const { char, reading } of align) {
    if (!isKanaChar(char) && !charMap.has(char)) {
      charMap.set(char, reading);
    }
  }
  // 转换：假名保留，汉字按映射替换，未知字符保留
  let result = '';
  for (const ch of input) {
    if (isKanaChar(ch)) {
      result += ch;
    } else if (charMap.has(ch)) {
      result += charMap.get(ch)!;
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * 校验听写输入是否正确。
 * 支持以下情况都算对（前提：没有拼错）：
 * 1. 完全匹配汉字形式（如 "お母さん"）
 * 2. 完全匹配假名形式（如 "おかあさん"）
 * 3. 汉字/假名混合形式（如 "お母さん" 写成 "おかあさん" 或 "お母かあさん"）
 *    —— 将输入归一化为假名后与 kana 比较
 * 4. 忽略首尾空格和中间空格
 */
export function checkDictationInput(
  input: string,
  expected: string,
  kana: string
): boolean {
  const trimmed = input.trim();
  if (trimmed === '') return false;

  // 去除所有空白后比较（处理中间有空格的情况）
  const noSpaceInput = trimmed.replace(/\s/g, '');
  const noSpaceExpected = expected.replace(/\s/g, '');
  const noSpaceKana = kana.replace(/\s/g, '');

  // 1. 直接匹配汉字形式或假名形式
  if (noSpaceInput === noSpaceExpected || noSpaceInput === noSpaceKana) {
    return true;
  }

  // 2. 归一化为假名后比较（处理混合输入）
  const inputKana = toKanaForm(noSpaceInput, noSpaceExpected, noSpaceKana);
  if (inputKana === noSpaceKana) {
    return true;
  }

  return false;
}
