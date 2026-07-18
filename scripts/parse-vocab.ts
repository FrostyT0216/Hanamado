/**
 * Parse anki-jlpt-decks notes.csv into per-level JSON files.
 *
 * Usage: npx tsx scripts/parse-vocab.ts
 *
 * The script downloads notes.csv from GitHub, parses the TSV data,
 * groups entries by JLPT level, and writes JSON files to public/data/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const CSV_URL =
  'https://raw.githubusercontent.com/5mdld/anki-jlpt-decks/main/deck-source/notes.csv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VocabSentence {
  kanji: string;
  furigana: string;
  translation: string;
}

interface VocabEntry {
  id: string;
  kanji: string;
  furigana: string;
  pitch: string;
  pos: string;
  definition: string;
  notes: string;
  sentences: VocabSentence[];
  level: string;
}

interface VocabIndex {
  levels: Record<string, { count: number; file: string }>;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseTSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\t' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function normalizeValue(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/**
 * CSV column layout (37 columns, no header row):
 *   [0] Notetype/Deck  [1] Sub-deck path (contains level)  [2] NoteID
 *   [3] VocabKanji     [4] VocabPitch   [5] VocabPoS      [6] VocabFurigana
 *   [7] VocabDefSC     [8] VocabDefTC   [9] VocabPlus     [10] VocabAudio
 *   [11] SentType1    [12] SentKanji1  [13] SentFurigana1 [14] SentDefSC1
 *   [15] SentDefTC1   [16] SentAudio1  [17] SentType2     [18] SentKanji2
 *   [19] SentFurigana2[20] SentDefSC2  [21] SentDefTC2    [22] SentAudio2
 *   [23] SentType3    [24] SentKanji3  [25] SentFurigana3 [26] SentDefSC3
 *   [27] SentDefTC3   [28] SentAudio3  [29] SentType4     [30] SentKanji4
 *   [31] SentFurigana4[32] SentDefSC4  [33] SentDefTC4    [34] SentAudio4
 *   [35] Sort          [36] Tags
 */
const COL = {
  SUBDECK: 1,
  NOTE_ID: 2,
  KANJI: 3,
  PITCH: 4,
  POS: 5,
  FURIGANA: 6,
  DEF_SC: 7,
  DEF_TC: 8,
  PLUS: 9,
  SENT_BASE: 11, // SentType1; SentKanji1 = 12, etc.
} as const;

const SENT_GROUP_SIZE = 6;
const MAX_SENTENCES = 4;

function extractLevelFromPath(subdeck: string): string | null {
  // e.g. "eggrolls-JLPT10k-v3.5::3-N3::3-低频" → "N3"
  // e.g. "eggrolls-JLPT10k-v3.5::1-N5" → "N5"
  const match = subdeck.match(/::(?:\d+-)?(N\d)\b/);
  return match ? match[1] : null;
}

function parseCSV(csvText: string): VocabEntry[] {
  const lines = csvText.split('\n');
  const entries: VocabEntry[] = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const fields = parseTSVLine(line);
    if (fields.length < 37) {
      skipped++;
      continue;
    }

    const subdeck = normalizeValue(fields[COL.SUBDECK] || '');
    const level = extractLevelFromPath(subdeck);
    if (!level) {
      skipped++;
      continue;
    }

    const noteId = normalizeValue(fields[COL.NOTE_ID] || '');
    if (!noteId) {
      skipped++;
      continue;
    }

    const sentences: VocabSentence[] = [];
    for (let s = 0; s < MAX_SENTENCES; s++) {
      const base = COL.SENT_BASE + s * SENT_GROUP_SIZE;
      const kanji = normalizeValue(fields[base + 1] || '');
      const furigana = normalizeValue(fields[base + 2] || '');
      const translation = normalizeValue(fields[base + 3] || '');
      if (kanji || translation) {
        sentences.push({ kanji, furigana, translation });
      }
    }

    entries.push({
      id: noteId,
      kanji: normalizeValue(fields[COL.KANJI] || ''),
      furigana: normalizeValue(fields[COL.FURIGANA] || ''),
      pitch: normalizeValue(fields[COL.PITCH] || ''),
      pos: normalizeValue(fields[COL.POS] || ''),
      definition:
        normalizeValue(fields[COL.DEF_SC] || '') ||
        normalizeValue(fields[COL.DEF_TC] || ''),
      notes: normalizeValue(fields[COL.PLUS] || ''),
      sentences,
      level,
    });
  }

  console.log(`Parsed ${entries.length} entries, skipped ${skipped} lines`);
  return entries;
}

function groupByLevel(entries: VocabEntry[]): Map<string, VocabEntry[]> {
  const groups = new Map<string, VocabEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.level) || [];
    list.push(entry);
    groups.set(entry.level, list);
  }
  return groups;
}

/**
 * Build a lightweight search index: maps kanji/furigana → [id, level][].
 * This is loaded once at startup (~200 KB) and used for O(1) token lookups.
 */
function buildSearchIndex(
  entries: VocabEntry[]
): Record<string, [string, string][]> {
  const index: Record<string, [string, string][]> = {};
  for (const entry of entries) {
    const keys = new Set<string>();
    if (entry.kanji) keys.add(entry.kanji);
    if (entry.furigana) keys.add(entry.furigana);
    for (const key of keys) {
      if (!index[key]) index[key] = [];
      index[key].push([entry.id, entry.level]);
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function downloadCSV(url: string): Promise<string> {
  console.log(`Downloading ${url} ...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const text = await response.text();
  console.log(`Downloaded ${(text.length / 1024 / 1024).toFixed(1)} MB`);
  return text;
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Try local file first, fall back to download
  const localPath = path.join(DATA_DIR, 'notes.csv');
  let csvText: string;
  if (fs.existsSync(localPath)) {
    console.log(`Reading local ${localPath} ...`);
    csvText = fs.readFileSync(localPath, 'utf-8');
    console.log(`Read ${(csvText.length / 1024 / 1024).toFixed(1)} MB`);
  } else {
    csvText = await downloadCSV(CSV_URL);
  }
  const entries = parseCSV(csvText);

  const groups = groupByLevel(entries);
  const index: VocabIndex = { levels: {} };

  const levelOrder = ['N5', 'N4', 'N3', 'N2', 'N1'];

  for (const level of levelOrder) {
    const list = groups.get(level);
    if (!list) {
      console.log(`  ${level}: 0 entries (skipped)`);
      continue;
    }

    const file = `vocab-${level.toLowerCase()}.json`;
    const filePath = path.join(DATA_DIR, file);
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
    const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(1);
    console.log(`  ${level}: ${list.length} entries → ${file} (${sizeKB} KB)`);

    index.levels[level] = { count: list.length, file };
  }

  const indexPath = path.join(DATA_DIR, 'vocab-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`Index written to vocab-index.json`);

  // Build and write search index
  const searchIndex = buildSearchIndex(entries);
  const searchPath = path.join(DATA_DIR, 'vocab-search.json');
  // Compact format to minimize file size (no pretty-print)
  fs.writeFileSync(searchPath, JSON.stringify(searchIndex), 'utf-8');
  const searchKB = (fs.statSync(searchPath).size / 1024).toFixed(1);
  const searchKeys = Object.keys(searchIndex).length;
  console.log(`Search index: ${searchKeys} unique keys → vocab-search.json (${searchKB} KB)`);

  console.log(
    `\nDone! Total: ${entries.length} entries across ${Object.keys(index.levels).length} levels.`
  );
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});