/**
 * Bybit asset / wallet entry points. Paths change by region and product.
 * Offer a few options in the UI — Help always resolves.
 */

/** Primary Assets entry (user hub). */
export const BYBIT_APP_ASSETS_HOME_HREF = 'https://www.bybit.com/user/assets/home/';

/** Logged-in deposit / top-up flow (redirects to login if needed). */
export const BYBIT_DEPOSIT_HREF = 'https://www.bybit.com/user/assets/deposit';

/** MEXC spot / funding deposit (logged-in). */
export const MEXC_DEPOSIT_HREF = 'https://www.mexc.com/assets/deposit';

/** Alternate assets route (exchange index) when the `/app/` hub misbehaves. */
export const BYBIT_USER_ASSETS_EXCHANGE_HREF = 'https://www.bybit.com/user/assets/exchange/index';

/** Official help — always loads; use if every deep link 404s or redirects oddly. */
export const BYBIT_TRANSFER_HELP_HREF =
  'https://www.bybit.com/en/help-center/article/How-to-Transfer-Assets-on-Bybit';

/** Default for callers that pass a single href into the trade panel. */
export const BYBIT_ASSET_TRANSFER_HREF = BYBIT_APP_ASSETS_HOME_HREF;
