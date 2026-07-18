import type {
  AiReviewQuiz,
  ApiConfig,
  LocalAiEntry,
  VocabEntry,
  VocabLevel,
  VocabSentence,
} from '@/types';
import { generateReviewQuiz } from './ai';
import { getEntryById } from './vocabService';
import { getAiEntry } from './aiWordStorage';

/** 统一目标词信息（供 AI 出题使用） */
interface QuizWord {
  kanji: string;
  furigana: string;
  definition: string;
  pos: string;
  sentences: VocabSentence[];
}

/** 把 JLPT/AI 词条统一为出题所需的字段结构 */
function toQuizWord(wordId: string): { word: QuizWord; level: VocabLevel } | null {
  // AI 收录词：wordId 形如 "ai:食べる"
  if (wordId.startsWith('ai:')) {
    const word = wordId.slice(3);
    const entry: LocalAiEntry | null = getAiEntry(word);
    if (!entry) return null;
    // AI 收录没有 level 字段，按词典形推断一个保守级别
    return {
      word: {
        kanji: entry.dictionary_form,
        furigana: entry.kana_form,
        definition: entry.definition,
        pos: entry.parts_of_speech.map((p) => p.term).join('、'),
        sentences: entry.example_sentences.map((s) => ({
          kanji: s.japanese,
          furigana: '',
          translation: s.chinese_translation,
        })),
      },
      level: 'N3',
    };
  }

  // 词库 ID 现在是 UUID，不再以 N[1-5]- 开头；直接用 id 反查
  const entry = getEntryById(wordId);
  if (!entry) return null;
  return {
    word: {
      kanji: entry.kanji,
      furigana: entry.furigana,
      definition: entry.definition,
      pos: entry.pos,
      sentences: entry.sentences,
    },
    level: entry.level,
  };
}

/**
 * 为新词学习生成 3 道 JLPT 风格练习题。
 */
export async function generateNewWordPractice(
  config: ApiConfig,
  wordId: string,
  signal?: AbortSignal
): Promise<AiReviewQuiz> {
  const target = toQuizWord(wordId);
  if (!target) {
    throw new Error(`Word not found: ${wordId}`);
  }
  return generateReviewQuiz(config, target.word, target.level, -1, 3, signal);
}

/**
 * 为到期复习生成 2-3 道 JLPT 风格测验题。
 *
 * @param stage 当前 stage（0..4），即将进行的第 stage+1 次复习
 */
export async function generateReviewPractice(
  config: ApiConfig,
  wordId: string,
  stage: number,
  signal?: AbortSignal
): Promise<AiReviewQuiz> {
  const target = toQuizWord(wordId);
  if (!target) {
    throw new Error(`Word not found: ${wordId}`);
  }
  // 题目数：stage 越高题越多，强化掌握判定
  const questionCount = stage >= 3 ? 3 : 2;
  return generateReviewQuiz(config, target.word, target.level, stage, questionCount, signal);
}

/** 仅供测试/调试：把 VocabEntry 转为出题结构 */
export function vocabEntryToQuizWord(entry: VocabEntry): QuizWord {
  return {
    kanji: entry.kanji,
    furigana: entry.furigana,
    definition: entry.definition,
    pos: entry.pos,
    sentences: entry.sentences,
  };
}
