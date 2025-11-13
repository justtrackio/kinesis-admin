// In dev we proxy /api to backend via Vite server to avoid CORS.
export const apiBaseUrl = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api');