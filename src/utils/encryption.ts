// Simple Base64 obfuscation for API key storage
// NOTE: This is NOT real encryption. The API key is still recoverable by anyone
// with browser DevTools access. For production, use Vercel Functions proxy
// to avoid storing the key on the client at all.

export function encrypt(text: string): string {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return btoa(text);
  }
}

export function decrypt(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return atob(encoded);
  }
}