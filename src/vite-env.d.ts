/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override market news scan API path (default `/api/ai/news-scan`). */
  readonly VITE_NEWS_SCAN_ENDPOINT?: string;
  /** Set to "false" to skip a second model call when grounded quick/deep output fails validation (saves API cost). */
  readonly VITE_AI_GROUNDED_RETRY_ON_INVALID?: string;
  readonly VITE_BACKEND_API_BASE?: string;
  /** Set to "true" to use static mock trade prices on `/trade` (local demo only). */
  readonly VITE_USE_MOCK_TRADE_DATA?: string;
  readonly VITE_DEV_USER_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
