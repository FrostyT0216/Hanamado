import type { Role, Difficulty, ReplyLength, VocabLevel, VocabSentence } from '@/types';
import { REPLY_LENGTH_INFO } from '@/data/roles';

export function buildChatSystemPrompt(
  role: Role,
  difficulty: Difficulty,
  replyLength?: ReplyLength
): string {
  const diffInfo = {
    beginner: { vocab: 'N5–N4 基础词汇', grammar: '简单句型', length: '1–2 句' },
    intermediate: { vocab: 'N3–N2 词汇', grammar: '中等复杂句', length: '2–3 句' },
    advanced: { vocab: 'N1+ 词汇', grammar: '复杂句，敬语与简语灵活切换', length: '3–5 句' },
  }[difficulty];

  // replyLength 优先级高于 difficulty 默认 length；旧会话无 replyLength 时不注入额外指令
  const lengthOverride = replyLength ? REPLY_LENGTH_INFO[replyLength] : null;

  const personaBlock = role.persona?.trim()
    ? `\n\n以下是你的完整人设，请始终一致地演绎这个角色——不要直接复述设定，而是通过语气、用词、提及的经历与心事自然流露：\n${role.persona.trim()}\n`
    : '';

  const lengthBlock = lengthOverride
    ? `\n回复长度：${lengthOverride.instruction}（整体回复含 JSON 开销请严格控制在约 ${lengthOverride.maxTokens} tokens 以内，不得超过。）`
    : '';

  return `你是日语对话伙伴「${role.name}（${role.nameJa}）」。
用语习惯：${role.speechStyle}
场景：${role.scenario}
难度：${difficulty === 'beginner' ? '初级' : difficulty === 'intermediate' ? '中级' : '高级'}（${diffInfo.vocab}，${diffInfo.length}，${diffInfo.grammar}）${personaBlock}${lengthBlock}
必须严格按JSON格式回复，不要添加任何其他文字。`;
}

/**
 * Format instruction appended to every user message to enforce JSON output.
 * Kept concise to avoid consuming output tokens with overly verbose rules.
 */
export const CHAT_FORMAT_HINT =
  '\n\n[回复格式] 只输出一行合法JSON，不要markdown、不要解释。\n' +
  '{"message":"你回复用户的日语句子","tokens":["分词1","分词2","标点"],"translation":"中文翻译"}\n' +
  '分词规则：助词（は/が/を/に/で/と/へ/から/まで/の/も/や/か/ね/よ 等）和助动词（です/ます/た/だ/ない/れる/られる 等）必须单独成词；动词/形容词拆分活用；名词保持完整；标点单独成词。正确：["私","は","学生","です"]  错误：["私は","学生です"]';

export function buildGrammarSystemPrompt(sentence: string): string {
  return `你是一位专业的日语教师。请用中文解释以下日语句子的语法。

要分析的句子：${sentence}

请从以下方面分析：
1. 整体句子结构和意思
2. 关键语法点逐一讲解
3. 类似表达方式
4. 使用场景和注意事项

请使用 Markdown 格式组织你的回答，使其清晰易读。不要包在 markdown 代码块内，直接输出可渲染的 Markdown。`;
}

export function buildGrammarCorrectionPrompt(sentence: string): string {
  return `你是一位专业的日语教师。请对以下日语句子的语法错误进行纠错。

要纠错的句子：${sentence}

请按以下结构用 Markdown 格式回答（不要包在代码块内，直接输出可渲染的 Markdown）：

1. **纠正后的句子**：给出语法正确、自然流畅的日文句子。
2. **错误分析**：逐条列出原句中的语法问题，说明错误原因并给出修改建议。
3. **补充说明**（可选）：补充更自然的表达、使用场景或敬语等注意事项。

如果原句没有语法错误，请直接说明句子正确，并给出简要评价。`;
}

/**
 * Lightweight prompt for the secondary grammar-check call.
 * Only returns a JSON array of errors (or empty array).
 */
export function buildGrammarCheckPrompt(sentence: string): string {
  return `你是日语语法检查器。请检查以下日语句子的语法错误。

要检查的句子：${sentence}

请只输出一行合法JSON，不要任何解释：
- 没有错误时：[ ]
- 有错误时：[{"start":错误起始字符位置,"end":错误结束字符位置,"message":"中文错误说明","suggestion":"正确写法"}]

规则：
- start/end 从 0 开始计数，end 不包含
- message 和 suggestion 中不能包含未转义的双引号或换行
- 只输出 JSON 数组本身，不要有其他文字`;
}

/**
 * 构建复习/新词练习出题 prompt。
 *
 * @param word        目标词信息（统一字段名，便于 AI 识别）
 * @param level       JLPT 级别
 * @param stage       -1=新词学习即时练习；0..4=对应待通过第 (stage+1) 次复习
 * @param questionCount 题目数量（新词练习=3，复习=2-3）
 */
export function buildReviewQuizPrompt(
  word: {
    kanji: string;
    furigana: string;
    definition: string;
    pos: string;
    sentences: VocabSentence[];
  },
  level: VocabLevel,
  stage: number,
  questionCount: number
): string {
  const example = word.sentences[0];
  const exampleText = example
    ? `例句：${example.kanji}${example.furigana ? `（${example.furigana}）` : ''}　${example.translation}`
    : '';

  const mode = stage < 0
    ? '【模式：新词初次学习练习】每个词出 3 道不同类型题目，用于巩固刚学的新词。'
    : `【模式：第 ${stage + 1} 次复习测验】共 ${REVIEW_STAGE_LABEL[stage] ?? ''}，出 ${questionCount} 道题目。`;

  const isKanaOnly = word.kanji.trim() === word.furigana.trim();

  return `你是 JLPT 日语考试出题专家。请严格模仿 JLPT 真题「言語知識（文字・語彙）」部分的格式与风格，为以下目标词生成题目。

${mode}

目标词：
- 汉字表记：${word.kanji}
- 假名读音：${word.furigana}
- 词性：${word.pos}
- 释义：${word.definition}
${exampleText}
JLPT 级别：${level}

题型说明（每次从以下 4 种类型中随机选 ${questionCount} 种，不可重复）：

1. "reading"：漢字読み（JLPT 問題1）
   - prompt 固定为「次の言葉の読み方として最もよいものを、1・2・3・4から一つ選びなさい。」
   - stem 为一句完整的日文句子，目标词用下划线标出，例如「住民は建設会社を相手に、_____を起こした。」
   - options 为 4 个假名读音，正确项为目标词的读音，其余 3 项为同级别常见词的读音干扰

2. "kanji"：漢字表記（JLPT 問題2）
   - prompt 固定为「次の言葉を漢字で書くとき、最もよいものを、1・2・3・4から一つ選びなさい。」
   - stem 为一句完整的日文句子，目标词以假名形式用下划线标出，例如「住民は建設会社を相手に、_____を起こした。」
   - options 为 4 个汉字写法，正确项为目标词的汉字，其余 3 项为形近/音近干扰写法

3. "fillblank"：文脈規定（JLPT 問題3）
   - prompt 固定为「（ ）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。」
   - stem 为一句完整的日文句子，空格处应填入目标词，例如「最近、味が（ ）になっている。」
   - options 为 4 个日文词或短语，正确项为目标词，其余 3 项为语法或语义干扰项

4. "usage"：使い方（JLPT 問題4）
   - prompt 固定为「次の言葉の使い方として最もよいものを、1・2・3・4から一つ選びなさい。」
   - stem 为目标词本身，例如「おおげさ」
   - options 为 4 个完整的日文句子，其中只有一句正确、自然地使用了目标词；其余 3 句在语义、搭配或语境上不正确

严格按以下 JSON 格式返回，不要 markdown 代码块，不要任何解释：
{
  "word": "${word.kanji}",
  "questions": [
    {
      "type": "reading",
      "prompt": "次の言葉の読み方として最もよいものを、1・2・3・4から一つ選びなさい。",
      "stem": "彼は新しい研究開発に_____んでいる。",
      "options": ["ちょう", "てい", "かけ", "のぞ"],
      "answer": 0,
      "explanation": "「挑む」读作「いどむ」，正确项是「のぞ」（选项4）。"
    },
    {
      "type": "kanji",
      "prompt": "次の言葉を漢字で書くとき、最もよいものを、1・2・3・4から一つ選びなさい。",
      "stem": "田中さんはピアノが_____です。",
      "options": ["上手", "上首", "上水", "上主"],
      "answer": 0,
      "explanation": "「じょうず」的规范汉字写法是「上手」；「上首」「上水」「上主」都不是日语中的常用词或标准写法。"
    },
    {
      "type": "fillblank",
      "prompt": "（ ）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
      "stem": "毎朝、6時に（ ）を起きるようにしている。",
      "options": ["必ず", "普通", "特に", "大切"],
      "answer": 0,
      "explanation": "「必ず起きる」表示"一定起床"；「普通」「特に」后不接「を起きる」，「大切を起きる」搭配不当。"
    },
    {
      "type": "usage",
      "prompt": "次の言葉の使い方として最もよいものを、1・2・3・4から一つ選びなさい。",
      "stem": "おおげさ",
      "options": [
        "彼の活躍はおおげさに言える。",
        "部屋がおおげさになっている。",
        "おおげさに食べ過ぎてしまった。",
        "今日の天気はおおげさだ。"
      ],
      "answer": 0,
      "explanation": "「おおげさ」意为"夸大、夸张"，常与「に言う/に書く」搭配；其他选项语义或搭配不当。"
    }
  ]
}

要求：
1. 必须输出恰好 ${questionCount} 道题目，类型不重复
2. 4 个选项必须完全不同，禁止任何重复；answer 必须为正确答案在当前 options 数组中的真实索引（0-3），我会后处理随机打乱顺序
3. 所有选项必须是日文（假名、汉字或日文句子），禁止使用中文选项
4. 每道题必须有且只有一个正确答案。如果某个空格在语法上可填入多个合理答案（如「毎週（ ）ようびに…」可以填任何星期），必须通过上下文限定（人物、时间、情境、习惯、前后文暗示等）使答案唯一；否则宁可换词出题
5. 干扰项必须是明确错误的选项：在语义、搭配、读音或语境上至少有一处明显不成立，不能是"语法上也说得通"的近义替换；kanji 题型中三个干扰项必须是不同于正确写法的其他汉字组合
6. stem 必须是自然、完整的日文句子，优先使用 JLPT 真题常见句型和语境
7. explanation 用简短中文，30-60 字，必须说明两点：①正确选项为什么对；②其他选项/常见错误为什么错。禁止 explanation 为空或与题目无关
8. fillblank 题型的 stem 必须包含（ ）占位符
${isKanaOnly ? '9. 目标词为纯假名，优先出 fillblank 与 usage 题型，避免 reading/kanji' : '9. 尽量覆盖不同题型，让练习更接近真实 JLPT 考试'}`;
}

/** 复习阶段标签 */
const REVIEW_STAGE_LABEL: Record<number, string> = {
  0: '1 天后复习',
  1: '3 天后复习',
  2: '7 天后复习',
  3: '15 天后复习',
  4: '30 天后复习',
};
