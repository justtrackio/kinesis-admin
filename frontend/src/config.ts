// Runtime config loaded from /config.json (can be replaced after build)
let cachedConfig: { apiBaseUrl: string } | null = null;

export async function loadConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch('/config.json');
    cachedConfig = await res.json();
    return cachedConfig;
  } catch (err) {
    console.warn('Failed to load config.json, using defaults', err);
    cachedConfig = { apiBaseUrl: '/api' };
    return cachedConfig;
  }
}

export function getApiBaseUrl(): string {
  if (!cachedConfig) {
    throw new Error('Config not loaded yet. Call loadConfig() first.');
  }
  return cachedConfig.apiBaseUrl;
}

// Fallback for build-time config (backwards compatible)
export const apiBaseUrl = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api');