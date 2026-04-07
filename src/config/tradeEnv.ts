/**
 * Set `VITE_USE_MOCK_TRADE_DATA=true` in `.env.local` to use static `mockTrade` prices (demo only).
 * Production builds should leave this unset so entry / stop / target derive from the live feed + signal.
 */
export const USE_MOCK_TRADE_DATA = import.meta.env.VITE_USE_MOCK_TRADE_DATA === 'true';
