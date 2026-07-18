import { encrypt, decrypt } from '@/utils/encryption';
import type { ApiConfig } from '@/types';

const STORAGE_KEY = 'hanamado-store';

export interface PersistedState {
  state: {
    sessions: unknown[];
    currentSessionId: string | null;
    apiConfig: ApiConfig | null;
    theme: 'light' | 'dark';
    accentColor: string;
  };
  version: number;
}

export function getStorageItem(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    // Decrypt API key if present
    if (parsed.state?.apiConfig?.apiKey) {
      parsed.state.apiConfig.apiKey = decrypt(parsed.state.apiConfig.apiKey);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setStorageItem(value: PersistedState): void {
  try {
    // Encrypt API key before storing
    const toStore = {
      ...value,
      state: {
        ...value.state,
        apiConfig: value.state.apiConfig
          ? {
              ...value.state.apiConfig,
              apiKey: encrypt(value.state.apiConfig.apiKey),
            }
          : null,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

export function removeStorageItem(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getStorageUsage(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? new Blob([raw]).size : 0;
}

// Custom storage adapter for Zustand persist middleware
export const encryptedStorage = {
  getItem: (name: string): string | null => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.apiConfig?.apiKey) {
        parsed.state.apiConfig.apiKey = decrypt(parsed.state.apiConfig.apiKey);
      }
      return JSON.stringify(parsed);
    } catch {
      return raw;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.apiConfig?.apiKey) {
        parsed.state = {
          ...parsed.state,
          apiConfig: {
            ...parsed.state.apiConfig,
            apiKey: encrypt(parsed.state.apiConfig.apiKey),
          },
        };
      }
      localStorage.setItem(name, JSON.stringify(parsed));
    } catch {
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};