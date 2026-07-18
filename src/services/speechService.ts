// 语音合成服务：使用浏览器 SpeechSynthesis API 播放日语单词音频
// 优先使用 ja-JP 本地语音；如果不可用，回退到任意可用日语语音。

let cachedJaVoice: SpeechSynthesisVoice | null | undefined = undefined;

function findJaVoice(): SpeechSynthesisVoice | null {
  if (cachedJaVoice !== undefined) return cachedJaVoice;
  if (typeof speechSynthesis === 'undefined') {
    cachedJaVoice = null;
    return null;
  }
  const voices = speechSynthesis.getVoices();
  // 优先日文本地语音
  const ja = voices.find((v) => v.lang === 'ja-JP' && v.localService)
    || voices.find((v) => v.lang === 'ja-JP')
    || voices.find((v) => v.lang.toLowerCase().startsWith('ja'));
  cachedJaVoice = ja ?? null;
  return cachedJaVoice;
}

// 异步等待 voices 加载完成（首次访问时浏览器可能尚未加载）
function ensureVoicesLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') {
      resolve();
      return;
    }
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedJaVoice = undefined; // 重置缓存以重新查找
      resolve();
      return;
    }
    let resolved = false;
    const handler = () => {
      if (resolved) return;
      resolved = true;
      cachedJaVoice = undefined;
      resolve();
    };
    speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
    // 兜底：500ms 后强制 resolve（某些浏览器不会触发 voiceschanged）
    setTimeout(handler, 500);
  });
}

/**
 * 播放日语单词音频
 * @param text 要朗读的日文文本（假名形式最准确）
 * @param options.rate 语速（默认 0.9 略慢以利于听写）
 */
export async function speakJapanese(
  text: string,
  options?: { rate?: number; signal?: AbortSignal }
): Promise<void> {
  if (typeof speechSynthesis === 'undefined') return;
  await ensureVoicesLoaded();
  if (options?.signal?.aborted) return;

  // 取消正在进行的朗读（避免排队）
  speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = options?.rate ?? 0.9;
  utter.pitch = 1;
  const voice = findJaVoice();
  if (voice) utter.voice = voice;

  return new Promise<void>((resolve) => {
    if (options?.signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      speechSynthesis.cancel();
      resolve();
    };
    options?.signal?.addEventListener('abort', onAbort, { once: true });
    utter.onend = () => {
      options?.signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    utter.onerror = () => {
      options?.signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    speechSynthesis.speak(utter);
  });
}

/** 检查语音合成是否可用 */
export function isSpeechSupported(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

/** 检查是否有可用的日语语音 */
export function hasJapaneseVoice(): boolean {
  return findJaVoice() !== null;
}
