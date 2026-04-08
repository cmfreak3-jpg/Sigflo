/**
 * Opt-in: `VITE_USE_MOCK_TRADE_DATA=true` uses static `mockTrade` on `/trade` for demos.
 * Otherwise trade pricing uses live Bybit + signal / URL context.
 */
export const USE_MOCK_TRADE_DATA = import.meta.env.VITE_USE_MOCK_TRADE_DATA === 'true';
