/**
 * 生成 KanjiVG 索引文件
 * 扫描 public/data/kanjivg/*.svg，解析笔画数，输出 public/data/kanjivg-index.json
 * 运行：node scripts/gen-kanjivg-index.js
 */
const fs = require('fs');
const path = require('path');

const KANJIVG_DIR = path.join(__dirname, '..', 'public', 'data', 'kanjivg');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'kanjivg-index.json');

function hexToChar(hex) {
  const code = parseInt(hex, 16);
  if (isNaN(code)) return null;
  return String.fromCodePoint(code);
}

function countStrokes(svgContent) {
  // 计算 <path 标签数量（KanjiVG 每个 path 代表一笔）
  const matches = svgContent.match(/<path\b/g);
  return matches ? matches.length : 0;
}

function main() {
  if (!fs.existsSync(KANJIVG_DIR)) {
    console.error(`Error: ${KANJIVG_DIR} not found. Please download kanjivg-js data first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(KANJIVG_DIR).filter((f) => f.endsWith('.svg'));
  console.log(`Found ${files.length} SVG files`);

  const index = {};
  let count = 0;

  for (const file of files) {
    const hex = file.replace('.svg', '');
    const char = hexToChar(hex);
    if (!char) continue;

    const filePath = path.join(KANJIVG_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const sc = countStrokes(content);

    if (sc > 0) {
      index[char] = { hex, sc };
      count++;
    }
  }

  const output = JSON.stringify(index);
  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(`Generated index with ${count} characters → ${OUTPUT_PATH}`);
  console.log(`File size: ${(Buffer.byteLength(output) / 1024).toFixed(1)} KB`);
}

main();
