/**
 * 必应随机壁纸服务
 *
 * 使用 https://bing.img.run/rand.php 直接作为图片源，
 * 该接口每次请求返回一张随机的 Bing 历史壁纸（1080P）。
 *
 * 注意：URL 本身不变时浏览器会缓存，因此「换一张」需要在 URL 上
 * 拼接时间戳作为 cache-buster。
 */

const BING_RANDOM_URL = 'https://bing.img.run/rand.php';

/**
 * 生成一个新的必应随机壁纸 URL（带 cache-buster）
 *
 * @returns 可直接用于 <img src> 或 CSS background-image 的 URL
 */
export function generateBingImageUrl(): string {
  return `${BING_RANDOM_URL}?t=${Date.now()}`;
}
