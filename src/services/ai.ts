import type { AiWordEntry, AiReviewQuiz, ApiConfig, GrammarError, Message, ReviewQuestion, VocabLevel, VocabSentence } from '@/types';
import { CHAT_FORMAT_HINT, buildGrammarCheckPrompt, buildReviewQuizPrompt } from '@/utils/prompts';

// ========== Error Types ==========

export class AiResponseFormatError extends Error {
  /** Raw AI response content for debugging */
  public rawContent: string;

  constructor(message: string = 'AI 响应格式异常，请重试', rawContent: string = '') {
    super(message);
    this.name = 'AiResponseFormatError';
    this.rawContent = rawContent;
  }
}

export class AiNetworkError extends Error {
  constructor(message: string = '网络请求失败，请检查网络连接') {
    super(message);
    this.name = 'AiNetworkError';
  }
}

// ========== Helpers ==========

export function buildMessages(
  systemPrompt: string,
  history: Message[],
  userMessage?: string
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Keep only recent history to avoid overloading the model with long contexts.
  const recentHistory = history.slice(-6);

  for (const msg of recentHistory) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'ai' && msg.content && msg.status === 'sent') {
      messages.push({ role: 'assistant', content: msg.content });
    }
  }

  if (userMessage) {
    messages.push({ role: 'user', content: userMessage + CHAT_FORMAT_HINT });
  }

  return messages;
}

// ========== Japanese Tokenizer (for plain-text fallback) ==========

/**
 * Heuristic Japanese tokenizer with particle/auxiliary-verb splitting.
 *
 * Pipeline:
 * 1. Split by punctuation (punctuation kept as separate tokens)
 * 2. Split each segment by character-type transitions (kanji↔hiragana↔katakana…)
 * 3. Post-process hiragana tokens: split known grammatical suffixes
 *    (particles 助詞 & auxiliary verbs 助動詞) from the end of hiragana runs.
 *
 * This is a best-effort fallback — not a proper morphological analyzer.
 *
 * Character type categories:
 * - CJK (kanji): \p{Script=Han}
 * - Hiragana: \p{Script=Hiragana}
 * - Katakana: \p{Script=Katakana}
 * - Latin/ASCII: A-Za-z
 * - Digit: 0-9
 * - Punctuation: 。、！？…―
 * - Other
 */

/**
 * Known grammatical suffixes (particles & auxiliary verbs) sorted longest-first
 * for greedy matching. Only applied to purely-hiragana tokens to avoid
 * splitting kanji compounds.
 */
const GRAMMATICAL_SUFFIXES: string[] = [
  // Polite/formal auxiliaries (longest first)
  'ました', 'ません', 'まして', 'ます',
  // Compound particles
  'から', 'まで', 'より', 'だけ', 'しか', 'など', 'ほど',
  'ぐらい', 'くらい', 'こそ', 'さえ', 'すら', 'でも', 'とも',
  'って', 'たって', 'だって',
  // Passive/causative auxiliaries
  'られる', 'させる', 'れる', 'せる',
  // Evidential/hearsay/appearance
  'そうだ', 'ようだ', 'らしい', 'みたい', 'そう', 'よう',
  // Desire
  'たい',
  // Copula & negation
  'です', 'でした', 'だ', 'ない', 'なかった', 'ぬ', 'ず',
  // Aspect (progressive/perfect)
  'ている', 'ていた', 'ています', 'ていました',
  'てる', 'てた', 'でいる', 'でいた',
  // Conjunctive particles
  'ので', 'のに', 'けど', 'けれど', 'けれども', 'が',
  'し', 'ながら', 'たり', 'つつ',
  // Sentence-ending particles
  'かしら', 'かな', 'わ', 'ぞ', 'ぜ', 'さ',
  // Short particles (must come AFTER longer ones to avoid premature match)
  'は', 'が', 'を', 'に', 'で', 'と', 'へ', 'も', 'や', 'か',
  'の', 'よ', 'ね', 'な', 'ば', 'て', 'た', 'にて',
];

/**
 * Try to split a single grammatical suffix from the END of a hiragana token.
 * Returns [remainingStem, suffix] if a suffix is found, or null.
 * Only splits if the remaining stem is non-empty.
 */
function trySplitSuffix(token: string): [string, string] | null {
  if (token.length < 2) return null;

  for (const suffix of GRAMMATICAL_SUFFIXES) {
    if (token.endsWith(suffix) && token.length > suffix.length) {
      const stem = token.slice(0, -suffix.length);
      // Guard: don't leave an empty stem
      if (stem.length > 0) {
        return [stem, suffix];
      }
    }
  }
  return null;
}

/**
 * Recursively split grammatical suffixes from a hiragana token.
 * E.g. "しています" → ["し", "て", "います"] → ["し", "て", "い", "ます"]
 * (second pass splits "います" further)
 */
function splitHiraganaGrammaticals(token: string): string[] {
  // Only process pure-hiragana tokens (no kanji, katakana, latin, etc.)
  if (!token || !/^[\p{Script=Hiragana}]+$/u.test(token)) {
    return [token];
  }

  const result: string[] = [];
  let remaining = token;

  // Iteratively split suffixes from the end
  let progress = true;
  while (progress && remaining.length > 0) {
    progress = false;
    const split = trySplitSuffix(remaining);
    if (split) {
      // Suffix found — push the suffix and continue with the stem
      result.unshift(split[1]);
      remaining = split[0];
      progress = true;
    }
  }

  // Whatever remains is the lexical stem
  if (remaining.length > 0) {
    result.unshift(remaining);
  }

  return result.length > 0 ? result : [token];
}

function tokenizeJapanese(text: string): string[] {
  if (!text.trim()) return [];

  const tokens: string[] = [];
  const punctuation = /[。、！？…―！？，．]/g;

  // First, split by punctuation (keeping punctuation as separate tokens)
  const segments: string[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  const punctRegex = new RegExp(punctuation.source, 'g');

  while ((match = punctRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push(text.substring(lastIdx, match.index));
    }
    segments.push(match[0]); // punctuation as separate token
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    segments.push(text.substring(lastIdx));
  }

  // Then, split each segment by character type transitions
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // If it's a single punctuation, keep as-is
    if (punctuation.test(trimmed) && trimmed.length === 1) {
      tokens.push(trimmed);
      continue;
    }

    const subTokens = splitByCharType(trimmed);
    // Post-process: split hiragana tokens into stem + grammatical suffixes
    for (const subToken of subTokens) {
      const splitTokens = splitHiraganaGrammaticals(subToken);
      tokens.push(...splitTokens);
    }
  }

  return tokens.filter((t) => t.length > 0);
}

function getCharType(ch: string): string {
  if (/^[\p{Script=Han}]$/u.test(ch)) return 'kanji';
  if (/^[\p{Script=Hiragana}]$/u.test(ch)) return 'hiragana';
  if (/^[\p{Script=Katakana}]$/u.test(ch)) return 'katakana';
  if (/^[A-Za-z]$/.test(ch)) return 'latin';
  if (/^[0-9]$/.test(ch)) return 'digit';
  if (/^[。、！？…―！？，．]$/.test(ch)) return 'punct';
  return 'other';
}

function splitByCharType(text: string): string[] {
  if (!text) return [];
  const result: string[] = [];
  let currentToken = '';
  let currentType = '';

  for (const ch of text) {
    const type = getCharType(ch);

    // Always break on punctuation
    if (type === 'punct') {
      if (currentToken) {
        result.push(currentToken);
        currentToken = '';
      }
      result.push(ch);
      currentType = '';
      continue;
    }

    // If type changes, start a new token
    if (type !== currentType && currentToken) {
      result.push(currentToken);
      currentToken = '';
    }

    currentToken += ch;
    currentType = type;
  }

  if (currentToken) {
    result.push(currentToken);
  }

  return result;
}

// ========== JSON Extraction & Repair ==========

/**
 * Extract a balanced JSON object from text by counting curly braces.
 * Handles strings and escape sequences correctly.
 */
export function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(start, i + 1);
      }
    }
  }

  return null; // Unbalanced braces
}

/**
 * Attempt to repair common JSON formatting issues from AI output.
 * Applied in order: trailing commas, comments, unescaped control chars.
 */
export function repairJson(json: string): string {
  let repaired = json;

  // 1. Remove trailing commas before } or ] (most common AI mistake)
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // 2. Remove single-line // comments (but not URLs like https://)
  repaired = repaired.replace(/(?<!:)\/\/.*$/gm, '');

  // 3. Remove block comments /* ... */
  repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');

  // 4. Fix unescaped control characters in strings (0x00-0x1F except common ones)
  // This is a best-effort: replace bare newlines/tabs inside strings
  repaired = repaired.replace(
    /"([^"\\]*?)[\x00-\x08\x0B\x0C\x0E-\x1F]([^"\\]*?)"/g,
    (_, before, after) => `"${before}${after}"`
  );

  return repaired;
}

/**
 * Extract a string value for a given JSON key using regex.
 * Handles both double-quoted and single-quoted keys.
 * Example: "message": "hello" or 'message': 'hello'
 */
export function extractStringField(content: string, key: string): string {
  // Double-quoted key and value
  const dqMatch = content.match(
    new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's')
  );
  if (dqMatch) {
    try { return JSON.parse(`"${dqMatch[1]}"`); } catch { return dqMatch[1]; }
  }
  // Single-quoted key and value
  const sqMatch = content.match(
    new RegExp(`'${key}'\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 's')
  );
  if (sqMatch) {
    try { return sqMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'); } catch { return sqMatch[1]; }
  }
  return '';
}

/**
 * Extract a JSON array for a given key using bracket counting.
 * Handles both double-quoted and single-quoted keys.
 */
export function extractArrayField(content: string, key: string): string[] {
  // Try double-quoted key first, then single-quoted
  for (const quote of ['"', "'"]) {
    const keyIdx = content.indexOf(`${quote}${key}${quote}`);
    if (keyIdx === -1) continue;

    const afterKey = content.substring(keyIdx);
    const arrayStart = afterKey.indexOf('[');
    if (arrayStart === -1) continue;

    // Extract balanced array bracket
    let depth = 0;
    let inStr = false;
    let esc = false;
    let arrayEnd = -1;
    for (let i = arrayStart; i < afterKey.length; i++) {
      const ch = afterKey[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"' || ch === "'") { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) { arrayEnd = i; break; }
      }
    }

    if (arrayEnd === -1) continue;

    const arrayStr = afterKey.substring(arrayStart, arrayEnd + 1);
    try {
      const parsed = JSON.parse(arrayStr);
      if (Array.isArray(parsed)) return parsed.map((t: unknown) => String(t));
    } catch {
      // Try to extract individual string elements
      const strMatches = arrayStr.match(/"((?:[^"\\]|\\.)*)"/g)
        || arrayStr.match(/'((?:[^'\\]|\\.)*)'/g);
      if (strMatches) {
        return strMatches.map((s) => {
          try { return JSON.parse(s); } catch { return s.replace(/^["']|["']$/g, ''); }
        });
      }
    }
  }

  return [];
}

/**
 * Extract grammar_errors array from broken JSON using bracket counting.
 */
function extractGrammarErrorsByRegex(content: string): GrammarError[] | undefined {
  const keyIdx = content.indexOf('"grammar_errors"');
  if (keyIdx === -1) return undefined;

  const afterKey = content.substring(keyIdx);
  const arrayStart = afterKey.indexOf('[');
  if (arrayStart === -1) return undefined;

  // Find the matching closing bracket
  let depth = 0;
  let inStr = false;
  let esc = false;
  let arrayEnd = -1;
  for (let i = arrayStart; i < afterKey.length; i++) {
    const ch = afterKey[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) { arrayEnd = i; break; }
    }
  }

  if (arrayEnd === -1) return undefined;

  const arrayStr = afterKey.substring(arrayStart, arrayEnd + 1);
  try {
    const parsed = JSON.parse(arrayStr);
    if (Array.isArray(parsed)) {
      const errors: GrammarError[] = [];
      for (const e of parsed) {
        if (
          typeof e === 'object' &&
          e !== null &&
          typeof e.start === 'number' &&
          typeof e.end === 'number' &&
          typeof e.message === 'string'
        ) {
          errors.push({
            start: e.start,
            end: e.end,
            message: e.message,
            suggestion: typeof e.suggestion === 'string' ? e.suggestion : undefined,
          });
        }
      }
      return errors.length > 0 ? errors : undefined;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Parse a JSON array returned by the dedicated grammar-check call.
 * Tolerates common AI mistakes such as markdown code blocks and trailing commas.
 */
function parseGrammarErrorsArray(content: string): GrammarError[] | undefined {
  const raw = content.trim();

  const strategies: Array<{ name: string; fn: () => unknown }> = [
    { name: 'direct', fn: () => JSON.parse(raw) },
    {
      name: 'codeblock',
      fn: () => {
        const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (!match) throw new Error('No code block');
        return JSON.parse(match[1].trim());
      },
    },
    {
      name: 'balanced',
      fn: () => {
        const balanced = extractBalancedJson(raw);
        if (!balanced) throw new Error('No balanced JSON');
        return JSON.parse(balanced);
      },
    },
    {
      name: 'repair',
      fn: () => JSON.parse(repairJson(raw)),
    },
  ];

  for (const strategy of strategies) {
    try {
      const parsed = strategy.fn();
      if (!Array.isArray(parsed)) continue;
      const errors: GrammarError[] = [];
      for (const e of parsed) {
        if (
          typeof e === 'object' &&
          e !== null &&
          typeof e.start === 'number' &&
          typeof e.end === 'number' &&
          typeof e.message === 'string'
        ) {
          errors.push({
            start: e.start,
            end: e.end,
            message: e.message,
            suggestion: typeof e.suggestion === 'string' ? e.suggestion : undefined,
          });
        }
      }
      return errors.length > 0 ? errors : undefined;
    } catch {
      // try next strategy
    }
  }

  return undefined;
}

/**
 * Last-resort: try to extract individual fields using regex when JSON is
 * too broken to parse as a whole object.
 */
function extractFieldsByRegex(content: string): AiChatResponse | null {
  const message = extractStringField(content, 'message');
  const translation = extractStringField(content, 'translation');
  const tokens = extractArrayField(content, 'tokens');

  if (!message && !translation && tokens.length === 0) return null;

  return {
    message: message || '(解析失败)',
    tokens,
    translation: translation || '(解析失败)',
    grammarErrors: extractGrammarErrorsByRegex(content),
  };
}

// ========== Main Parser ==========

export interface AiChatResponse {
  message: string;
  tokens: string[];
  translation: string;
  grammarErrors?: GrammarError[];
}

/**
 * Extract and validate grammar_errors from the parsed AI response data.
 * Returns undefined if no valid errors are found.
 */
function extractGrammarErrors(data: Record<string, unknown>): GrammarError[] | undefined {
  const errors = data.grammar_errors;
  if (!Array.isArray(errors) || errors.length === 0) return undefined;

  const validErrors: GrammarError[] = [];
  for (const e of errors) {
    if (
      typeof e === 'object' &&
      e !== null &&
      typeof (e as Record<string, unknown>).start === 'number' &&
      typeof (e as Record<string, unknown>).end === 'number' &&
      typeof (e as Record<string, unknown>).message === 'string'
    ) {
      validErrors.push({
        start: (e as Record<string, unknown>).start as number,
        end: (e as Record<string, unknown>).end as number,
        message: (e as Record<string, unknown>).message as string,
        suggestion:
          typeof (e as Record<string, unknown>).suggestion === 'string'
            ? (e as Record<string, unknown>).suggestion as string
            : undefined,
      });
    }
  }
  return validErrors.length > 0 ? validErrors : undefined;
}

/**
 * Multi-strategy AI response parser.
 *
 * Tries the following strategies in order:
 * 1. Direct JSON.parse on trimmed content
 * 2. Extract from ```json ... ``` markdown code block
 * 3. Extract balanced JSON via bracket counting
 * 4. Extract balanced JSON + repair common issues
 * 5. Repair on trimmed content, then parse
 * 6. Field-level regex extraction (handles double & single quotes)
 * 7. Plain-text fallback: treat entire response as the "message" field
 */
function parseAiResponse(content: string): AiChatResponse {
  const raw = content;
  const trimmed = content.trim();

  const strategies: Array<{ name: string; fn: () => unknown }> = [];

  // Strategy 1: Direct parse
  strategies.push({
    name: 'direct',
    fn: () => JSON.parse(trimmed),
  });

  // Strategy 2: Extract from markdown code block
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    strategies.push({
      name: 'codeblock',
      fn: () => JSON.parse(codeBlockMatch[1].trim()),
    });
  }

  // Strategy 3: Balanced bracket extraction
  const balanced = extractBalancedJson(content);
  if (balanced) {
    if (balanced !== trimmed) {
      strategies.push({
        name: 'balanced',
        fn: () => JSON.parse(balanced),
      });
    }
    // Strategy 4: Balanced + repair
    strategies.push({
      name: 'balanced+repair',
      fn: () => JSON.parse(repairJson(balanced)),
    });
  }

  // Strategy 5: Repair on trimmed content
  const repaired = repairJson(trimmed);
  if (repaired !== trimmed) {
    strategies.push({
      name: 'repair',
      fn: () => JSON.parse(repaired),
    });
  }

  // Strategy 5b: Try replacing single quotes with double quotes
  if (trimmed.includes("'")) {
    strategies.push({
      name: 'single-quote',
      fn: () => {
        // Conservative: only replace single quotes that look like JSON keys/values
        const fixed = trimmed.replace(/'([^'{}[\]:,\s]+)'\s*:/g, '"$1":');
        return JSON.parse(fixed);
      },
    });
  }

  // Strategy 5c: Strip grammar_errors field if it's causing parse issues
  // (AI sometimes generates malformed content inside grammar_errors, such as
  // unescaped quotes or newlines in the message field.)
  strategies.push({
    name: 'strip-grammar-errors',
    fn: () => {
      const key = '"grammar_errors"';
      const keyIdx = trimmed.indexOf(key);
      if (keyIdx === -1) throw new Error('No grammar_errors field');

      // Find the array value after the key
      const afterKey = trimmed.substring(keyIdx + key.length);
      const colonMatch = afterKey.match(/^\s*:\s*/);
      if (!colonMatch) throw new Error('No colon after grammar_errors');
      const arrayStart = keyIdx + key.length + colonMatch[0].length;

      // Bracket-count to find the end of the array
      let depth = 0;
      let inStr = false;
      let escaped = false;
      let arrayEnd = -1;
      for (let i = arrayStart; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inStr) { escaped = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '[') depth++;
        else if (ch === ']') {
          depth--;
          if (depth === 0) { arrayEnd = i; break; }
        }
      }

      if (arrayEnd === -1) throw new Error('Unbalanced grammar_errors array');

      // Replace the array content with empty array
      const stripped = trimmed.substring(0, arrayStart + 1) + ']' + trimmed.substring(arrayEnd + 1);
      return JSON.parse(stripped);
    },
  });

  // Strategy 5d: Brute-force remove grammar_errors with regex (last structural fix)
  strategies.push({
    name: 'strip-grammar-errors-re',
    fn: () => {
      const stripped = trimmed.replace(/"grammar_errors"\s*:\s*\[[\s\S]*?\](?=\s*[,}])/g, '"grammar_errors":[]');
      if (stripped === trimmed) throw new Error('No grammar_errors to strip');
      return JSON.parse(stripped);
    },
  });

  // Try each strategy
  let lastError: unknown = null;

  for (const strategy of strategies) {
    try {
      const parsed = strategy.fn();
      const data = parsed as Record<string, unknown>;
      if (
        typeof data.message === 'string' &&
        Array.isArray(data.tokens) &&
        typeof data.translation === 'string'
      ) {
        if (import.meta.env.DEV) {
          console.log(
            `[AI Parser] [OK] Parsed via "${strategy.name}" strategy`
          );
        }
        return {
          message: data.message,
          tokens: data.tokens.map((t: unknown) => String(t)),
          translation: data.translation,
          grammarErrors: extractGrammarErrors(data),
        };
      }
      lastError = new Error('Parsed JSON missing required fields');
    } catch (e) {
      lastError = e;
    }
  }

  // Strategy 6: Field-level regex extraction (last resort before plain text)
  const fieldResult = extractFieldsByRegex(content);
  if (fieldResult) {
    if (import.meta.env.DEV) {
      console.warn(
        '[AI Parser] [WARN] Used field-level regex extraction. Raw:',
        raw
      );
    }
    return fieldResult;
  }

  // Strategy 7: Ultimate fallback — treat the entire response as plain text
  // This handles cases where the AI ignores the JSON format entirely.
  // We auto-tokenize the Japanese text so dictionary lookup still works.
  const plainText = raw.trim();
  if (plainText.length > 0) {
    const autoTokens = tokenizeJapanese(plainText);
    console.warn(
      '[AI Parser] [WARN] All JSON strategies failed. Using plain-text fallback. Raw:',
      raw
    );
    return {
      message: plainText,
      tokens: autoTokens,
      translation: '(自动解析，仅供参考)',
    };
  }

  // Truly nothing to work with
  console.error('[AI Parser] [FAIL] Empty response after all strategies. Raw:', raw);
  throw new AiResponseFormatError(
    'AI 返回了无法解析的内容，请重试',
    raw
  );
}

// ========== API Calls ==========

export async function sendChatMessage(
  config: ApiConfig,
  systemPrompt: string,
  history: Message[],
  userMessage: string
): Promise<AiChatResponse> {
  const messages = buildMessages(systemPrompt, history, userMessage);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: Math.max(config.temperature, 1.0),
        max_tokens: 2048,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
      }),
    });
  } catch (e) {
    throw new AiNetworkError();
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new AiNetworkError(
      `API 请求失败 (${response.status}): ${errorText.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const message = choice?.message;
  let content: string | undefined = message?.content;
  const reasoningContent: string | undefined = message?.reasoning_content;

  // Fallback: some reasoning models put the answer in reasoning_content
  if (!content && reasoningContent) {
    content = reasoningContent;
  }

  if (!content) {
    throw new AiResponseFormatError('AI 返回了空内容');
  }

  try {
    const result = parseAiResponse(content);
    return result;
  } catch (e) {
    throw e;
  }
}

export async function queryGrammar(
  config: ApiConfig,
  systemPrompt: string,
  userContent: string,
  signal?: AbortSignal
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 1.0,
        max_tokens: 2048,
        thinking: { type: 'disabled' },
      }),
      signal,
    });
  } catch (e) {
    // 用户主动取消或超时：抛出 AbortError，调用方可据此区分
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new AiNetworkError();
  }

  if (!response.ok) {
    throw new AiNetworkError(`API 请求失败 (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new AiResponseFormatError('AI 返回了空内容');
  }

  return content;
}

/**
 * Secondary call: check the user's message for grammar errors.
 * Uses a lightweight prompt that only asks for a JSON array.
 */
export async function checkGrammarErrors(
  config: ApiConfig,
  sentence: string
): Promise<GrammarError[] | undefined> {
  const messages = [
    {
      role: 'user',
      content:
        `检查以下日语句子的语法错误，只输出JSON数组，不要任何解释、思考或推理过程。\n\n` +
        `句子：${sentence}\n\n` +
        `格式：[{"start":起始位置,"end":结束位置,"message":"中文说明","suggestion":"正确写法"}]\n` +
        `没有错误时输出：[]`,
    },
  ];

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 1.0,
        max_tokens: 1024,
        thinking: { type: 'disabled' },
      }),
    });
  } catch {
    throw new AiNetworkError();
  }

  if (!response.ok) {
    throw new AiNetworkError(`API 请求失败 (${response.status})`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const message = choice?.message;
  let content: string | undefined = message?.content;
  const reasoningContent: string | undefined = message?.reasoning_content;

  if (!content && reasoningContent) {
    content = reasoningContent;
  }

  if (!content) {
    return undefined;
  }

  try {
    const errors = parseGrammarErrorsArray(content);
    return errors;
  } catch (e) {
    return undefined;
  }
}

export async function testConnection(
  config: ApiConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        message: `连接失败 (${response.status}): ${errorText.slice(0, 200)}`,
      };
    }

    return { success: true, message: '连接成功！API 配置有效。' };
  } catch (e) {
    return {
      success: false,
      message: `网络错误: ${e instanceof Error ? e.message : '无法连接到服务器'}`,
    };
  }
}

// ========== AI Word Query Parser ==========

/**
 * Validate that a parsed object has the required AiWordEntry shape.
 */
function validateWordEntry(data: Record<string, unknown>): boolean {
  return (
    typeof data.dictionary_form === 'string' && data.dictionary_form.length > 0 &&
    typeof data.kana_form === 'string' && data.kana_form.length > 0 &&
    typeof data.romaji === 'string' &&
    Array.isArray(data.parts_of_speech) &&
    typeof data.definition === 'string' &&
    Array.isArray(data.example_sentences)
  );
}

/**
 * Extract an array of objects for a given key using bracket counting.
 * Returns the parsed array of objects, or an empty array on failure.
 */
function extractArrayOfObjects(
  content: string,
  key: string,
  objectKeys: string[]
): Record<string, string>[] {
  // Try double-quoted key first, then single-quoted
  for (const quote of ['"', "'"]) {
    const keyIdx = content.indexOf(`${quote}${key}${quote}`);
    if (keyIdx === -1) continue;

    const afterKey = content.substring(keyIdx);
    const arrayStart = afterKey.indexOf('[');
    if (arrayStart === -1) continue;

    // Extract balanced array bracket
    let depth = 0;
    let inStr = false;
    let esc = false;
    let arrayEnd = -1;
    for (let i = arrayStart; i < afterKey.length; i++) {
      const ch = afterKey[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"' || ch === "'") { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) { arrayEnd = i; break; }
      }
    }

    if (arrayEnd === -1) continue;

    const arrayStr = afterKey.substring(arrayStart, arrayEnd + 1);
    try {
      const parsed = JSON.parse(arrayStr);
      if (Array.isArray(parsed)) {
        return parsed.map((item: unknown) => {
          if (typeof item === 'object' && item !== null) {
            const result: Record<string, string> = {};
            for (const k of objectKeys) {
              const val = (item as Record<string, unknown>)[k];
              result[k] = typeof val === 'string' ? val : '';
            }
            return result;
          }
          const result: Record<string, string> = {};
          for (const k of objectKeys) {
            result[k] = '';
          }
          return result;
        });
      }
    } catch {
      // Try to extract individual objects from the array string
      const results: Record<string, string>[] = [];
      // Find each {...} object boundary
      let objDepth = 0;
      let objStart = -1;
      let inStr2 = false;
      let esc2 = false;
      for (let i = 0; i < arrayStr.length; i++) {
        const ch = arrayStr[i];
        if (esc2) { esc2 = false; continue; }
        if (ch === '\\' && inStr2) { esc2 = true; continue; }
        if (ch === '"' || ch === "'") { inStr2 = !inStr2; continue; }
        if (inStr2) continue;
        if (ch === '{') {
          if (objDepth === 0) objStart = i;
          objDepth++;
        } else if (ch === '}') {
          objDepth--;
          if (objDepth === 0 && objStart !== -1) {
            const objStr = arrayStr.substring(objStart, i + 1);
            const entry: Record<string, string> = {};
            for (const k of objectKeys) {
              entry[k] = extractStringField(objStr, k);
            }
            results.push(entry);
            objStart = -1;
          }
        }
      }
      return results;
    }
  }

  return [];
}

/**
 * Last-resort: extract word query fields using regex when JSON is too broken.
 */
function extractWordFieldsByRegex(content: string): AiWordEntry | null {
  const dictionary_form = extractStringField(content, 'dictionary_form');
  const kana_form = extractStringField(content, 'kana_form');
  const romaji = extractStringField(content, 'romaji');
  const pitch = extractStringField(content, 'pitch');
  const definition = extractStringField(content, 'definition');

  if (!dictionary_form && !kana_form) return null;

  const parts_of_speech = extractArrayOfObjects(content, 'parts_of_speech', ['term', 'translation']);
  const example_sentences = extractArrayOfObjects(content, 'example_sentences', ['japanese', 'chinese_translation']);

  return {
    dictionary_form: dictionary_form || '(解析失败)',
    kana_form: kana_form || '(解析失败)',
    romaji: romaji || '',
    pitch: pitch || '',
    parts_of_speech: parts_of_speech.map((p) => ({
      term: p.term || '',
      translation: p.translation || '',
    })),
    definition: definition || '(解析失败)',
    example_sentences: example_sentences.map((s) => ({
      japanese: s.japanese || '',
      chinese_translation: s.chinese_translation || '',
    })),
  };
}

/**
 * Multi-strategy AI word query response parser.
 *
 * Strategies (in order):
 * 1. Direct JSON.parse on trimmed content
 * 2. Extract from ```json ... ``` markdown code block
 * 3. Extract balanced JSON via bracket counting
 * 4. Extract balanced JSON + repair common issues
 * 5. Repair on trimmed content, then parse
 * 6. Single-quote replacement
 * 7. Field-level regex extraction (last resort)
 *
 * Returns null if all strategies fail.
 */
export function parseAiWordResponse(content: string): AiWordEntry | null {
  const strategies: Array<{ name: string; fn: () => unknown }> = [];

  // Strategy 1: Direct parse
  strategies.push({
    name: 'direct',
    fn: () => JSON.parse(content.trim()),
  });

  // Strategy 2: Extract from markdown code block
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    strategies.push({
      name: 'codeblock',
      fn: () => JSON.parse(codeBlockMatch[1].trim()),
    });
  }

  // Strategy 3: Balanced bracket extraction
  const balanced = extractBalancedJson(content);
  if (balanced) {
    if (balanced !== content.trim()) {
      strategies.push({
        name: 'balanced',
        fn: () => JSON.parse(balanced),
      });
    }
    // Strategy 4: Balanced + repair
    strategies.push({
      name: 'balanced+repair',
      fn: () => JSON.parse(repairJson(balanced)),
    });
  }

  // Strategy 5: Repair on trimmed content
  const trimmed = content.trim();
  const repaired = repairJson(trimmed);
  if (repaired !== trimmed) {
    strategies.push({
      name: 'repair',
      fn: () => JSON.parse(repaired),
    });
  }

  // Strategy 6: Replace single quotes with double quotes
  if (trimmed.includes("'")) {
    strategies.push({
      name: 'single-quote',
      fn: () => {
        const fixed = trimmed.replace(/'([^'{}[\]:,\s]+)'\s*:/g, '"$1":');
        return JSON.parse(fixed);
      },
    });
  }

  // Try each strategy
  for (const strategy of strategies) {
    try {
      const parsed = strategy.fn();
      const data = parsed as Record<string, unknown>;
      if (validateWordEntry(data)) {
        if (import.meta.env.DEV) {
          console.log(
            `[AI Word Parser] [OK] Parsed via "${strategy.name}" strategy`
          );
        }
        return {
          dictionary_form: data.dictionary_form as string,
          kana_form: data.kana_form as string,
          romaji: data.romaji as string,
          pitch: typeof data.pitch === 'string' ? data.pitch : '',
          parts_of_speech: (data.parts_of_speech as AiWordEntry['parts_of_speech']).map((p) => ({
            term: typeof p.term === 'string' ? p.term : '',
            translation: typeof p.translation === 'string' ? p.translation : '',
          })),
          definition: data.definition as string,
          example_sentences: (data.example_sentences as AiWordEntry['example_sentences']).map((s) => ({
            japanese: typeof s.japanese === 'string' ? s.japanese : '',
            chinese_translation: typeof s.chinese_translation === 'string' ? s.chinese_translation : '',
          })),
        };
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 7: Field-level regex extraction (last resort)
  const fieldResult = extractWordFieldsByRegex(content);
  if (fieldResult) {
    if (import.meta.env.DEV) {
      console.warn(
        '[AI Word Parser] [WARN] Used field-level regex extraction. Raw:',
        content
      );
    }
    return fieldResult;
  }

  return null;
}

/**
 * Query the AI for a word definition and return structured data.
 * Uses a system prompt that requires JSON output with the exact expected schema.
 */
export async function queryWordWithAI(
  config: ApiConfig,
  word: string
): Promise<AiWordEntry> {
  const systemPrompt = `你是一个日语词典。请用中文解释以下日语单词。请严格按照JSON格式返回，不要添加任何其他文字，不要用markdown代码块包裹：

{
  "dictionary_form": "辞书形（原形）",
  "kana_form": "假名读音",
  "romaji": "罗马音",
  "pitch": "声调标注（数字型，如0、1、2等，平板型填0）",
  "parts_of_speech": [
    {"term": "词性日文名", "translation": "词性中文翻译"}
  ],
  "definition": "详细的中文释义，包括该词的主要含义、用法说明和常见搭配",
  "example_sentences": [
    {"japanese": "日语句子", "chinese_translation": "中文翻译"}
  ]
}

请提供3个例句。parts_of_speech数组应包含该词的所有词性及其翻译。definition字段应提供详细完整的中文释义。`;

  const rawContent = await queryGrammar(config, systemPrompt, word);
  const parsed = parseAiWordResponse(rawContent);

  if (!parsed) {
    throw new AiResponseFormatError(
      'AI 单词查询返回了无法解析的内容，请重试',
      rawContent
    );
  }

  return parsed;
}

// ========== AI 出题（背单词复习 / 新词练习） ==========

const VALID_QUESTION_TYPES = new Set(['reading', 'kanji', 'fillblank', 'usage']);

/** 验证单道题目结构 */
function validateQuestion(q: unknown): q is ReviewQuestion {
  if (!q || typeof q !== 'object') return false;
  const obj = q as Record<string, unknown>;
  if (
    !(typeof obj.type === 'string' && VALID_QUESTION_TYPES.has(obj.type)) ||
    !(typeof obj.prompt === 'string' && obj.prompt.length > 0) ||
    !(typeof obj.stem === 'string') ||
    !(Array.isArray(obj.options) && obj.options.length === 4) ||
    !obj.options.every((o) => typeof o === 'string' && (o as string).trim().length > 0) ||
    !(typeof obj.answer === 'number' && obj.answer >= 0 && obj.answer <= 3) ||
    !(typeof obj.explanation === 'string' && obj.explanation.trim().length > 0)
  ) {
    return false;
  }
  // 四个选项必须完全不同
  const optionSet = new Set(obj.options as string[]);
  return optionSet.size === 4;
}

/**
 * 多策略解析 AI 出题返回（复用主解析器的基础设施）。
 */
function parseReviewQuiz(content: string): AiReviewQuiz | null {
  const strategies: Array<{ name: string; fn: () => unknown }> = [];

  strategies.push({ name: 'direct', fn: () => JSON.parse(content.trim()) });

  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    strategies.push({
      name: 'codeblock',
      fn: () => JSON.parse(codeBlockMatch[1].trim()),
    });
  }

  const balanced = extractBalancedJson(content);
  if (balanced) {
    if (balanced !== content.trim()) {
      strategies.push({ name: 'balanced', fn: () => JSON.parse(balanced) });
    }
    strategies.push({
      name: 'balanced+repair',
      fn: () => JSON.parse(repairJson(balanced)),
    });
  }

  const trimmed = content.trim();
  const repaired = repairJson(trimmed);
  if (repaired !== trimmed) {
    strategies.push({ name: 'repair', fn: () => JSON.parse(repaired) });
  }

  if (trimmed.includes("'")) {
    strategies.push({
      name: 'single-quote',
      fn: () => {
        const fixed = trimmed.replace(/'([^'{}[\]:,\s]+)'\s*:/g, '"$1":');
        return JSON.parse(fixed);
      },
    });
  }

  for (const strategy of strategies) {
    try {
      const parsed = strategy.fn();
      const data = parsed as Record<string, unknown>;
      const word = data.word;
      const questions = data.questions;
      if (
        typeof word === 'string' &&
        Array.isArray(questions) &&
        questions.length > 0 &&
        questions.every(validateQuestion)
      ) {
        if (import.meta.env.DEV) {
          console.log(`[AI Quiz Parser] [OK] Parsed via "${strategy.name}"`);
        }
        return {
          word,
          questions: questions as unknown as ReviewQuestion[],
        };
      }
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * 随机打乱单道题目的选项顺序，并同步修正 answer 索引。
 * 用于防止 AI 总是把正确答案放在固定位置（如 A/0）。
 */
function shuffleQuestionOptions(question: ReviewQuestion): ReviewQuestion {
  const correctOption = question.options[question.answer];
  const indices = question.options.map((_, i) => i);

  // Fisher-Yates 洗牌
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledOptions = indices.map((i) => question.options[i]);
  const newAnswer = indices.indexOf(question.answer);

  return {
    ...question,
    options: shuffledOptions,
    answer: newAnswer >= 0 ? newAnswer : shuffledOptions.indexOf(correctOption),
  };
}

/**
 * 调用 AI 生成 JLPT 风格题目。
 *
 * @param stage  -1=新词学习即时练习；0..4=对应待通过第 (stage+1) 次复习
 */
export async function generateReviewQuiz(
  config: ApiConfig,
  word: {
    kanji: string;
    furigana: string;
    definition: string;
    pos: string;
    sentences: VocabSentence[];
  },
  level: VocabLevel,
  stage: number,
  questionCount: number,
  signal?: AbortSignal
): Promise<AiReviewQuiz> {
  const userContent = buildReviewQuizPrompt(word, level, stage, questionCount);

  let lastRawContent = '';
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }

    const rawContent = await queryGrammar(config, '', userContent, signal);
    lastRawContent = rawContent;
    const parsed = parseReviewQuiz(rawContent);

    if (parsed) {
      return {
        ...parsed,
        questions: parsed.questions.map(shuffleQuestionOptions),
      };
    }

    if (import.meta.env.DEV) {
      console.warn(`[AI Quiz] parse failed on attempt ${attempt}/${maxRetries}`);
    }
  }

  throw new AiResponseFormatError(
    'AI 出题返回了无法解析或选项重复的内容，请重试',
    lastRawContent
  );
}