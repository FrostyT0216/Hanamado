import type { Role, Difficulty } from '@/types';

export const ROLES: Role[] = [
  {
    id: 'konbini',
    name: '便利店店员',
    nameJa: 'コンビニ店員',
    speechStyle: '敬语（です・ます体）',
    scenario: '日常购物',
    icon: 'shop',
    avatar: '/avatars/konbini.png',
  },
  {
    id: 'daigaku',
    name: '大学朋友',
    nameJa: '大学の友達',
    speechStyle: '简语（だ・である体）',
    scenario: '校园闲聊',
    icon: 'book',
    avatar: '/avatars/daigaku.png',
  },
  {
    id: 'mensetsu',
    name: '面试官',
    nameJa: '面接官',
    speechStyle: '敬语（正式）',
    scenario: '求职面试',
    icon: 'backpack',
    avatar: '/avatars/mensetsu.png',
  },
  {
    id: 'izakaya',
    name: '居酒屋老板',
    nameJa: '居酒屋の店主',
    speechStyle: '简语 + 行业用语',
    scenario: '餐饮社交',
    icon: 'liquor',
    avatar: '/avatars/izakaya.png',
  },
  {
    id: 'ryoko',
    name: '旅行向导',
    nameJa: '旅行ガイド',
    speechStyle: '敬语',
    scenario: '旅游问路',
    icon: 'map',
    avatar: '/avatars/ryoko.png',
  },
  {
    id: 'doryo',
    name: '同事',
    nameJa: '同僚',
    speechStyle: '敬语（适度）',
    scenario: '职场交流',
    icon: 'laptop',
    avatar: '/avatars/doryo.png',
  },
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
};

export const DIFFICULTY_INFO: Record<Difficulty, { vocab: string; grammar: string; length: string }> = {
  beginner: { vocab: 'N5–N4', grammar: '简单句型', length: '1–2 句' },
  intermediate: { vocab: 'N3–N2', grammar: '中等复杂句', length: '2–3 句' },
  advanced: { vocab: 'N1+', grammar: '复杂句/敬语多变', length: '3–5 句' },
};

export function getRoleById(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id);
}