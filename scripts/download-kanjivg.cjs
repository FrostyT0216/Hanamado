// 批量下载 KanjiVG SVG 文件到 public/data/kanjivg/
// 用法：node scripts/download-kanjivg.js
// 数据源：tempo-eng/kanjivg-js 仓库的 kanji/ 目录
//
// 策略：
// - 4 个 jsdelivr CDN 节点 + raw.githubusercontent 兜底
// - 并发 24 个，每个文件失败时按顺序尝试下一节点
// - 单文件最多重试 5 次（轮询所有节点）
// - 已存在的文件跳过（断点续传）

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_OWNER = 'tempo-eng';
const REPO_NAME = 'kanjivg-js';
const BRANCH = 'main';
const SUBDIR = 'kanji'; // 仓库内子目录

const CDN_TEMPLATES = [
  (f) => `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${BRANCH}/${SUBDIR}/${f}`,
  (f) => `https://fastly.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${BRANCH}/${SUBDIR}/${f}`,
  (f) => `https://gcore.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${BRANCH}/${SUBDIR}/${f}`,
  (f) => `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${SUBDIR}/${f}`,
];

const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data', 'kanjivg');
const FILE_LIST = process.env.KANJIVG_LIST
  ? path.resolve(process.env.KANJIVG_LIST)
  : path.join(require('os').tmpdir(), 'kanjivg-file-list.txt');

const CONCURRENCY = 24;

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { 'User-Agent': 'hanamado-kanjivg-downloader/1.0' },
        timeout: 15_000,
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // 跟随重定向
          res.resume();
          fetch(res.headers.location)
            .then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function downloadOne(filename) {
  const outPath = path.join(OUT_DIR, filename);
  // 断点续传：已存在且非空则跳过
  try {
    const st = fs.statSync(outPath);
    if (st.size > 0) return { filename, status: 'skip', size: st.size };
  } catch {
    /* 文件不存在，继续下载 */
  }
  // 依次尝试每个 CDN
  let lastErr = null;
  for (let i = 0; i < CDN_TEMPLATES.length; i++) {
    const url = CDN_TEMPLATES[i](filename);
    try {
      const buf = await fetch(url);
      if (buf.length === 0) {
        lastErr = new Error('empty');
        continue;
      }
      fs.writeFileSync(outPath, buf);
      return { filename, status: 'ok', size: buf.length, cdn: i };
    } catch (e) {
      lastErr = e;
    }
  }
  return { filename, status: 'fail', error: lastErr ? lastErr.message : 'unknown' };
}

async function main() {
  // 读取文件列表
  if (!fs.existsSync(FILE_LIST)) {
    console.error(`文件列表不存在: ${FILE_LIST}`);
    console.error('请先运行 GitHub API 获取 kanjivg 仓库的文件列表，或设置 KANJIVG_LIST 环境变量');
    process.exit(1);
  }
  const files = fs
    .readFileSync(FILE_LIST, 'utf8')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && s.endsWith('.svg'));
  console.log(`待下载文件数: ${files.length}`);
  console.log(`输出目录: ${OUT_DIR}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const failures = [];
  let processed = 0;
  const startTime = Date.now();

  // 并发池
  let idx = 0;
  async function worker(workerId) {
    while (idx < files.length) {
      const myIdx = idx++;
      const filename = files[myIdx];
      try {
        const r = await downloadOne(filename);
        if (r.status === 'ok') okCount++;
        else if (r.status === 'skip') skipCount++;
        else {
          failCount++;
          failures.push(filename);
        }
      } catch (e) {
        failCount++;
        failures.push(filename);
      }
      processed++;
      if (processed % 100 === 0 || processed === files.length) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = (processed / elapsed).toFixed(1);
        const eta = ((files.length - processed) / (processed / elapsed)).toFixed(0);
        process.stdout.write(
          `\r进度: ${processed}/${files.length} (${rate} f/s, ETA ${eta}s) | ok=${okCount} skip=${skipCount} fail=${failCount}   `,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  console.log('\n');
  console.log(`完成：ok=${okCount} skip=${skipCount} fail=${failCount}`);
  if (failures.length > 0) {
    const failLog = path.join(OUT_DIR, '..', 'kanjivg-download-failures.txt');
    fs.writeFileSync(failLog, failures.join('\n'));
    console.log(`失败列表已写入: ${failLog}`);
    console.log('可重新运行此脚本，已下载的文件会自动跳过。');
    process.exit(2);
  } else {
    console.log('所有文件下载完成！');
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
