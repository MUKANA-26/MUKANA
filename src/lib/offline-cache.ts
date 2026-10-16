"use client";

/**
 * Tiny read-only offline cache for LIST data (saved opportunities, applications).
 * Stores only the JSON the screens need — never CVs, placement letters or any document —
 * keyed per user, and is wiped on sign-out.
 */
const PREFIX = "mukana:offline:";

export interface Cached<T> {
  data: T;
  savedAt: number;
}

function safe<R>(fn: () => R, fallback: R): R {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function writeCache<T>(userId: string, key: string, data: T) {
  safe(() => localStorage.setItem(`${PREFIX}${userId}:${key}`, JSON.stringify({ data, savedAt: Date.now() } satisfies Cached<T>)), undefined);
}

export function readCache<T>(userId: string, key: string): Cached<T> | null {
  return safe(() => {
    const raw = localStorage.getItem(`${PREFIX}${userId}:${key}`);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  }, null);
}

export function clearOfflineCache() {
  safe(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  }, undefined);
  // Also drop any runtime caches the service worker made for pages.
  safe(() => {
    void navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
  }, undefined);
}

export interface OfflineResult<T> {
  data: T;
  /** True when the data came from the offline copy because the network request failed. */
  stale: boolean;
  savedAt?: number;
}

/** Wraps a fetcher: on success saves a copy; on network failure falls back to the last saved copy. */
export function withOfflineFallback<T>(userId: string, key: string, fetcher: () => Promise<T>) {
  return async (): Promise<OfflineResult<T>> => {
    try {
      const data = await fetcher();
      writeCache(userId, key, data);
      return { data, stale: false };
    } catch (error) {
      const cached = readCache<T>(userId, key);
      if (cached && (typeof navigator === "undefined" || !navigator.onLine || isNetworkError(error))) {
        return { data: cached.data, stale: true, savedAt: cached.savedAt };
      }
      throw error;
    }
  };
}

function isNetworkError(error: unknown) {
  const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");
  return /failed to fetch|network|load failed|fetch/i.test(msg);
}
