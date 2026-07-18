/**
 * 必应每日壁纸获取服务
 *
 * 通过 CORS 代理获取必应官方 API 返回的壁纸列表，
 * 随机选取一张作为背景图。
 */

const BING_API_URL =
  'https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN';

/** CORS 代理列表，按优先级尝试 */
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

interface BingImageItem {
  url: string;
  copyright: string;
}

interface BingApiResponse {
  images: BingImageItem[];
}

/**
 * 获取一张随机必应壁纸的完整 URL
 *
 * @returns 完整的图片 URL（可直接用于 CSS background-image）
 * @throws 网络错误或解析失败时抛出异常
 */
export async function fetchBingImageUrl(): Promise<string> {
  let lastError: unknown = null;

  for (const proxy of CORS_PROXIES) {
    try {
      const proxiedUrl = proxy(BING_API_URL);
      const response = await fetch(proxiedUrl, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const data: BingApiResponse = await response.json();
      if (!data.images || data.images.length === 0) {
        lastError = new Error('No images in response');
        continue;
      }
      // 随机选取一张
      const pick = data.images[Math.floor(Math.random() * data.images.length)];
      return 'https://cn.bing.com' + pick.url;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError ?? new Error('All CORS proxies failed');
}
