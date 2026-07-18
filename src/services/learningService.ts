import type {
  LearningSettings,
  VocabLevel,
  WordProgress,
  WordStatus,
} from '@/types';
import {
  REVIEW_INTERVALS_DAYS,
  TOTAL_REVIEW_STAGES,
} from '@/types';
import { getEntries } from './vocabService';
import { loadAiCollection } from './aiWordStorage';

const DAY_MS = 86_400_000;

/**
 * 计算下一次复习到期时间戳。
 * @param stage 当前已通过的复习次数（0..4 表示「即将进行第 stage+1 次复习」）
 *               5 表示已掌握
 * @param fromTime 起始时间（默认当前）
 */
export function scheduleNextReview(stage: number, fromTime: number = Date.now()): number {
  if (stage >= TOTAL_REVIEW_STAGES) return 0; // 已掌握
  if (stage < 0) return 0; // 异常兜底
  const intervalIdx = stage; // stage 0 → 1 天, stage 4 → 30 天
  return fromTime + REVIEW_INTERVALS_DAYS[intervalIdx] * DAY_MS;
}

/** 该词是否到期需要复习 */
export function isReviewDue(progress: WordProgress | undefined, now: number = Date.now()): boolean {
  if (!progress) return false;
  if (progress.status !== 'learning') return false;
  if (progress.nextReviewAt <= 0) return false;
  return progress.nextReviewAt <= now;
}

/** 判定本次复习是否通过（正确率 ≥ 80%） */
export function judgeReviewPass(correct: number, total: number): boolean {
  if (total <= 0) return false;
  return correct / total >= 0.8;
}

/** 生成新词初始学习进度（stage=0，1 天后到期复习） */
export function createInitialProgress(
  wordId: string,
  source: 'jlpt' | 'ai',
  level: VocabLevel | undefined,
  now: number = Date.now()
): WordProgress {
  return {
    wordId,
    source,
    level,
    status: 'learning',
    currentStage: 0,
    learnedAt: now,
    nextReviewAt: scheduleNextReview(0, now),
    lastReviewAt: 0,
    reviewHistory: [],
  };
}

/** 应用复习结果，返回新的进度对象（不可变） */
export function applyReviewResult(
  progress: WordProgress,
  passed: boolean,
  correct: number,
  total: number,
  now: number = Date.now()
): WordProgress {
  const stage = progress.currentStage;
  const record = {
    reviewedAt: now,
    stage,
    passed,
    correctCount: correct,
    totalCount: total,
  };

  if (!passed) {
    // 未通过：停留当前 stage，次日重试
    return {
      ...progress,
      nextReviewAt: now + DAY_MS,
      lastReviewAt: now,
      reviewHistory: [...progress.reviewHistory, record],
    };
  }

  // 通过：推进 stage
  const nextStage = stage + 1;
  if (nextStage >= TOTAL_REVIEW_STAGES) {
    // 已掌握
    const masteredStatus: WordStatus = 'mastered';
    return {
      ...progress,
      status: masteredStatus,
      currentStage: TOTAL_REVIEW_STAGES,
      nextReviewAt: 0,
      lastReviewAt: now,
      reviewHistory: [...progress.reviewHistory, record],
    };
  }

  return {
    ...progress,
    currentStage: nextStage,
    nextReviewAt: scheduleNextReview(nextStage, now),
    lastReviewAt: now,
    reviewHistory: [...progress.reviewHistory, record],
  };
}

/**
 * 从指定词源抽取一批新词 ID。
 *
 * @param settings      学习设置
 * @param excludeIds    需排除的 wordId 集合（已在 wordProgress 中）
 * @returns 抽到的 wordId 数组（若可用词不足则返回实际数量）
 */
export function pickNewBatchWordIds(
  settings: LearningSettings,
  excludeIds: Set<string>
): string[] {
  const candidates = getCandidateWordIds(settings);
  const available = candidates.filter((id) => !excludeIds.has(id));

  if (available.length === 0) return [];

  // Fisher-Yates 抽 batchSize 个
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const count = Math.min(settings.batchSize, shuffled.length);
  return shuffled.slice(0, count);
}

/** 根据词源设置获取所有候选 wordId */
export function getCandidateWordIds(settings: LearningSettings): string[] {
  switch (settings.source) {
    case 'jlpt': {
      const entries = getEntries(settings.selectedLevel);
      return entries.map((e) => e.id);
    }
    case 'ai': {
      const collection = loadAiCollection();
      return Object.values(collection).map((e) => `ai:${e.word}`);
    }
    case 'favorite': {
      // 收藏夹跨 JLPT 与 AI，由调用方传入；此处返回空，由 store 层注入
      return [];
    }
    default:
      return [];
  }
}

/** 收藏来源的候选 ID 需要外部传入 favoriteIds */
export function pickNewBatchFromFavorites(
  favoriteIds: string[],
  excludeIds: Set<string>,
  batchSize: number
): string[] {
  const available = favoriteIds.filter((id) => !excludeIds.has(id));
  if (available.length === 0) return [];

  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(batchSize, shuffled.length));
}
