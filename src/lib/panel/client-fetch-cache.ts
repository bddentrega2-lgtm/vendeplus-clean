"use client";

type CacheEntry = { expiresAt: number; data: unknown };

const responseCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();

function headersKey(headers?: HeadersInit) {
  return JSON.stringify(Array.from(new Headers(headers).entries()).sort());
}

export function clearPanelReadCache() {
  responseCache.clear();
  inflightRequests.clear();
}

export async function fetchPanelJson<T = any>(
  url: string,
  options: RequestInit = {},
  ttlMs = 15_000
): Promise<T> {
  const method = String(options.method || "GET").toUpperCase();

  if (method !== "GET") {
    clearPanelReadCache();
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error en la solicitud.");
    clearPanelReadCache();
    return data;
  }

  const key = `${url}|${headersKey(options.headers)}`;
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data as T;

  let request = inflightRequests.get(key) as Promise<T> | undefined;
  if (!request) {
    request = (async () => {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error en la solicitud.");
      responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
      return data as T;
    })();
    inflightRequests.set(key, request);
  }

  try {
    return await request;
  } finally {
    if (inflightRequests.get(key) === request) inflightRequests.delete(key);
  }
}
