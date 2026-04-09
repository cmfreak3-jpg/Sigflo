import { log } from '../lib/logger.js';
import { sanitizeHttpErrorDetail } from '../lib/httpErrorDetail.js';
import { getJson, signHmacSha256 } from './http.js';
import type {
  AccountBucketKind,
  AccountBucketSnapshot,
  BalanceItem,
  ClosedTradeItem,
  ConnectInput,
  ExchangeAdapter,
  ExchangeAccountBreakdown,
  PermissionCheck,
  PositionItem,
  ValidationResult,
} from './types.js';

const BASE_URL = 'https://api.bybit.com';
/** Bybit allows up to 60_000 ms; larger window absorbs client–server clock skew (NTP drift). */
const RECV_WINDOW = '60000';

type BybitResponse<T> = {
  retCode: number;
  retMsg: string;
  result: T;
};

type BybitWalletCoin = {
  coin?: string;
  walletBalance?: string;
  equity?: string;
  locked?: string;
  /** Some account types (e.g. Funding) expose free balance here. */
  availableBalance?: string;
  availableToWithdraw?: string;
  transferBalance?: string;
  /** Funding / promo balance (see `query-account-coins-balance` with `withBonus`). */
  bonus?: string;
  totalOrderIM?: string;
  totalPositionIM?: string;
  totalPositionMM?: string;
  unrealisedPnl?: string;
  /** Spot / manual borrow (UTA); subtract from wallet when deriving free margin (Bybit docs). */
  spotBorrow?: string;
};

type BybitWalletEntry = {
  totalEquity?: string;
  totalWalletBalance?: string;
  totalAvailableBalance?: string;
  totalMarginBalance?: string;
  totalInitialMargin?: string;
  totalPerpUPL?: string;
  coin?: BybitWalletCoin[];
};

type BybitWalletBalanceResult = {
  list?: BybitWalletEntry[];
};

/** `/v5/asset/transfer/query-account-coins-balance` — correct way to read Funding (FUND) wallet per Bybit docs. */
type QueryAccountCoinsBalanceResult = {
  memberId?: string;
  accountType?: string;
  balance?: Array<{
    coin: string;
    walletBalance?: string;
    transferBalance?: string;
    bonus?: string;
  }>;
};

function buildSignedHeaders(apiKey: string, apiSecret: string, queryString: string) {
  const timestamp = String(Date.now());
  const signaturePayload = `${timestamp}${apiKey}${RECV_WINDOW}${queryString}`;
  const signature = signHmacSha256(apiSecret, signaturePayload);
  return {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': RECV_WINDOW,
    'X-BAPI-SIGN': signature,
  };
}

async function privateGet<T>(path: string, params: Record<string, string>, creds: ConnectInput): Promise<T> {
  const queryString = new URLSearchParams(params).toString();
  const headers = buildSignedHeaders(creds.apiKey, creds.apiSecret, queryString);
  const data = await getJson<BybitResponse<T>>(`${BASE_URL}${path}?${queryString}`, headers);
  if (data.retCode !== 0) {
    throw new Error(`Bybit error: ${data.retMsg}`);
  }
  return data.result;
}

async function privatePost<TResult>(path: string, body: Record<string, unknown>, creds: ConnectInput): Promise<TResult> {
  const bodyStr = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signaturePayload = `${timestamp}${creds.apiKey}${RECV_WINDOW}${bodyStr}`;
  const signature = signHmacSha256(creds.apiSecret, signaturePayload);
  const headers: Record<string, string> = {
    'X-BAPI-API-KEY': creds.apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': RECV_WINDOW,
    'X-BAPI-SIGN': signature,
    'Content-Type': 'application/json',
  };
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { method: 'POST', headers, body: bodyStr });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.trim().slice(0, 400);
    try {
      const j = JSON.parse(text) as { retMsg?: string };
      if (j.retMsg != null) detail = j.retMsg;
    } catch {
      /* not JSON (e.g. HTML from CDN) */
    }
    detail = sanitizeHttpErrorDetail(detail, url);
    throw new Error(`Bybit HTTP ${res.status}: ${detail || 'request failed'}`);
  }
  let data: BybitResponse<TResult>;
  try {
    data = JSON.parse(text) as BybitResponse<TResult>;
  } catch {
    throw new Error(`Bybit returned non-JSON for ${path}`);
  }
  if (data.retCode !== 0) {
    throw new Error(`Bybit error: ${data.retMsg || 'request rejected'}`);
  }
  return data.result;
}

/** Public market data (no auth). */
async function publicMarketGet<TResult>(path: string, params: Record<string, string>): Promise<TResult> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Bybit public HTTP ${res.status}`);
  }
  const data = (await res.json()) as BybitResponse<TResult>;
  if (data.retCode !== 0) {
    throw new Error(data.retMsg || 'Bybit public error');
  }
  return data.result;
}

type BybitLotSizeFilter = {
  qtyStep?: string;
  minOrderQty?: string;
  maxOrderQty?: string;
  minOrderAmt?: string;
  maxOrderAmt?: string;
  basePrecision?: string;
  quotePrecision?: string;
};

type CachedLot = { expiryMs: number; lot: BybitLotSizeFilter };
const instrumentLotCache = new Map<string, CachedLot>();
const LOT_CACHE_TTL_MS = 60 * 60 * 1000;

function decimalPlacesFromStepString(stepStr: string): number {
  const n = Number(stepStr);
  if (!Number.isFinite(n) || n <= 0) return 8;
  const s = stepStr.includes('e') || stepStr.includes('E') ? n.toFixed(16) : stepStr;
  const parts = String(s).split('.');
  if (parts.length < 2) return 0;
  return parts[1].replace(/0+$/, '').length || 0;
}

/**
 * Floor qty to Bybit `qtyStep`, clamp to min/max. Prevents retCode 10001 "Qty invalid".
 */
function normalizeQtyToStep(
  qtyRaw: string,
  qtyStepStr: string,
  minQtyStr: string,
  maxQtyStr: string,
): string {
  const n = Number(String(qtyRaw).trim().replace(/,/g, ''));
  const step = Number(qtyStepStr);
  const minQ = Number(minQtyStr);
  const maxQ = Number(maxQtyStr);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Order qty must be a positive number');
  }
  if (!Number.isFinite(step) || step <= 0) {
    return String(qtyRaw).trim();
  }
  const tol = 1e-12;
  let k = Math.floor(n / step + tol);
  let adj = k * step;
  if (adj < minQ - tol) {
    const minK = Math.ceil(minQ / step - tol);
    adj = minK * step;
  }
  if (adj > maxQ) {
    const maxK = Math.floor(maxQ / step + tol);
    adj = maxK * step;
  }
  if (!Number.isFinite(adj) || adj < minQ - tol || adj <= 0) {
    throw new Error(
      `Order qty ${qtyRaw} is below this symbol's minimum (${minQtyStr}, step ${qtyStepStr}).`,
    );
  }
  const dec = Math.min(16, decimalPlacesFromStepString(qtyStepStr));
  let out = adj.toFixed(dec);
  out = out.replace(/\.?0+$/, '');
  return out === '' ? '0' : out;
}

async function fetchLotSizeFilter(category: 'linear' | 'spot', symbol: string): Promise<BybitLotSizeFilter | null> {
  const sym = symbol.toUpperCase();
  const key = `${category}:${sym}`;
  const now = Date.now();
  const hit = instrumentLotCache.get(key);
  if (hit && hit.expiryMs > now) {
    return hit.lot;
  }
  try {
    const result = await publicMarketGet<{ list?: Array<{ lotSizeFilter?: BybitLotSizeFilter }> }>(
      '/v5/market/instruments-info',
      { category, symbol: sym },
    );
    const row = result.list?.[0];
    const lot = row?.lotSizeFilter;
    if (!lot) {
      return null;
    }
    instrumentLotCache.set(key, { expiryMs: now + LOT_CACHE_TTL_MS, lot });
    return lot;
  } catch (e) {
    log('warn', 'Bybit instruments-info failed; skipping qty normalization.', {
      category,
      symbol: sym,
      error: String(e),
    });
    return null;
  }
}

export type BybitLinearOrderParams = {
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType: 'Market' | 'Limit';
  qty: string;
  reduceOnly?: boolean;
  price?: string;
  /** 0 one-way; 1 / 2 hedge sides (must match account mode). */
  positionIdx?: number;
  /** Attached TP/SL for linear perps (`/v5/order/create`). Omit when empty. Not valid with reduceOnly. */
  takeProfit?: string;
  stopLoss?: string;
};

export type BybitSpotOrderParams = {
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType: 'Market' | 'Limit';
  qty: string;
  /** Market buys often use quote qty (USDT); sells use base qty. */
  marketUnit: 'baseCoin' | 'quoteCoin';
  price?: string;
};

/** `/v5/user/query-api` result shape (subset). */
type BybitQueryApiResult = {
  readOnly?: number;
  permissions?: Record<string, unknown>;
};

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

/**
 * Parse Bybit key metadata. Note: the JSON field `readOnly: 0` contains the substring "read", so
 * string-based heuristics incorrectly treated trade keys as "read-only".
 */
function parsePermission(result: unknown): PermissionCheck {
  const r = result && typeof result === 'object' ? (result as BybitQueryApiResult) : {};
  const perms = r.permissions && typeof r.permissions === 'object' ? r.permissions : {};
  const wallet = asStringArray(perms.Wallet);
  const contract = asStringArray(perms.ContractTrade);
  const spot = asStringArray(perms.Spot);
  const options = asStringArray(perms.Options);

  /** Bybit: `1` = read-only key, `0` = read and write (can trade). */
  const keyReadOnlyMode = r.readOnly === 1;

  const withdrawalsEnabled = wallet.some((x) => x.toLowerCase() === 'withdraw');

  const canReadPositions =
    contract.some((x) => /position|order/i.test(x)) ||
    spot.some((x) => /trade/i.test(x)) ||
    options.some((x) => /trade/i.test(x));

  const canReadBalances =
    wallet.length > 0 ||
    contract.length > 0 ||
    spot.length > 0 ||
    Object.keys(perms).some((k) => asStringArray(perms[k]).length > 0);

  return {
    readOnly: keyReadOnlyMode,
    withdrawalsEnabled,
    canReadBalances,
    canReadPositions,
    raw: result,
  };
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Per Bybit v5 docs (post–Jan 2025 UNIFIED), coin-level `availableBalance` is deprecated; use account
 * `totalAvailableBalance` (USD) when present. When that is 0/null but margin is locked in coin rows,
 * derive ≈ free collateral from USDT/USDC lines: wallet − order/position IM − locks − bonus − borrow.
 */
function coinAvailableUsdApprox(c: BybitWalletCoin): number {
  const wb = toNum(c.walletBalance) ?? 0;
  const orderIm = toNum(c.totalOrderIM) ?? 0;
  const posIm = toNum(c.totalPositionIM) ?? 0;
  const locked = toNum(c.locked) ?? 0;
  const bonus = toNum(c.bonus) ?? 0;
  const borrow = toNum(c.spotBorrow) ?? 0;
  return Math.max(0, wb - orderIm - posIm - locked - bonus - borrow);
}

function resolveEntryAvailableBalance(entry: BybitWalletEntry): number | null {
  const coins = entry.coin ?? [];
  const top = toNum(entry.totalAvailableBalance);

  let derivedUsd = 0;
  for (const c of coins) {
    const sym = String(c.coin ?? '').trim().toUpperCase();
    if (sym !== 'USDT' && sym !== 'USDC' && sym !== 'USD') continue;
    derivedUsd += coinAvailableUsdApprox(c);
  }

  let legacy = 0;
  let hasLegacy = false;
  for (const c of coins) {
    const ab = toNum(c.availableBalance);
    if (ab != null && Number.isFinite(ab)) {
      legacy += ab;
      hasLegacy = true;
    }
  }

  if (top != null && Number.isFinite(top) && top > 0) return top;
  if (hasLegacy && legacy > 0) return legacy;
  if (derivedUsd > 0) return derivedUsd;
  if (top != null && Number.isFinite(top)) return top;
  return derivedUsd > 0 ? derivedUsd : null;
}

function toBucketAssets(coins: BybitWalletCoin[]): BalanceItem[] {
  return coins
    .map((coin) => {
      const wb = toNum(coin.walletBalance);
      const eq = toNum(coin.equity);
      const ab = toNum(coin.availableBalance);
      const tb = toNum(coin.transferBalance);
      const bn = toNum(coin.bonus);
      const totalRaw = wb ?? eq ?? ab ?? tb ?? bn ?? 0;
      const total = Number.isFinite(totalRaw) ? totalRaw : 0;
      const freeCandidate = toNum(coin.availableToWithdraw) ?? toNum(coin.availableBalance) ?? tb;
      const free = freeCandidate != null && Number.isFinite(freeCandidate) ? Math.max(0, freeCandidate) : total;
      const locked = Math.max(0, total - free);
      return {
        asset: String(coin.coin ?? 'UNK').toUpperCase(),
        free,
        locked,
        total,
      };
    })
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total);
}

function bucketMeta(kind: AccountBucketKind): { label: string; helperText: string } {
  if (kind === 'funding') {
    return { label: 'Funding Balance', helperText: 'Funding = deposit / transfer wallet' };
  }
  if (kind === 'unified') {
    return { label: 'Unified Trading Account', helperText: 'Unified = active trading account' };
  }
  if (kind === 'spot') {
    return { label: 'Spot Balance', helperText: 'Spot wallet balances for spot holdings' };
  }
  return { label: 'Derivatives / Perps', helperText: 'Perps margin bucket for derivatives positions' };
}

function toBucketSnapshot(kind: AccountBucketKind, entry: BybitWalletEntry): AccountBucketSnapshot {
  const coins = entry.coin ?? [];
  const assets = toBucketAssets(coins);
  const marginUsedFromIm = toNum(entry.totalInitialMargin);
  const meta = bucketMeta(kind);
  const walletFromCoins =
    assets.length > 0 ? assets.reduce((sum, a) => sum + (Number.isFinite(a.total) ? a.total : 0), 0) : null;
  const walletFromApi = toNum(entry.totalWalletBalance);
  const equityFromApi = toNum(entry.totalEquity);
  const availResolved = resolveEntryAvailableBalance(entry);
  return {
    kind,
    label: meta.label,
    helperText: meta.helperText,
    metrics: {
      availableBalance: availResolved,
      walletBalance: walletFromApi ?? (walletFromCoins != null && walletFromCoins > 0 ? walletFromCoins : null),
      equity: equityFromApi ?? null,
      marginBalance: toNum(entry.totalMarginBalance) ?? null,
      marginUsed: marginUsedFromIm,
      unrealizedPnl: toNum(entry.totalPerpUPL) ?? null,
    },
    assets,
  };
}

const BUCKET_ORDER: AccountBucketKind[] = ['unified', 'funding', 'spot', 'derivatives'];

function sortBuckets(buckets: AccountBucketSnapshot[]): AccountBucketSnapshot[] {
  return [...buckets].sort((a, b) => BUCKET_ORDER.indexOf(a.kind) - BUCKET_ORDER.indexOf(b.kind));
}

function sumStrField(a: string | undefined, b: string | undefined): string {
  const x = toNum(a) ?? 0;
  const y = toNum(b) ?? 0;
  return String(x + y);
}

/** Bybit may return multiple `list` rows for one account type — merge coins and totals. */
function mergeWalletEntries(entries: BybitWalletEntry[]): BybitWalletEntry {
  if (entries.length <= 1) return entries[0] ?? {};
  const coinMap = new Map<string, BybitWalletCoin>();
  for (const e of entries) {
    for (const c of e.coin ?? []) {
      const sym = String(c.coin ?? '').trim().toUpperCase();
      if (!sym) continue;
      const prev = coinMap.get(sym);
      if (!prev) {
        coinMap.set(sym, { ...c, coin: sym });
        continue;
      }
      coinMap.set(sym, {
        ...prev,
        coin: sym,
        walletBalance: sumStrField(prev.walletBalance, c.walletBalance),
        equity: sumStrField(prev.equity, c.equity),
        availableBalance: sumStrField(prev.availableBalance, c.availableBalance),
        availableToWithdraw: sumStrField(prev.availableToWithdraw, c.availableToWithdraw),
        transferBalance: sumStrField(prev.transferBalance, c.transferBalance),
        bonus: sumStrField(prev.bonus, c.bonus),
        totalOrderIM: sumStrField(prev.totalOrderIM, c.totalOrderIM),
        totalPositionIM: sumStrField(prev.totalPositionIM, c.totalPositionIM),
        locked: sumStrField(prev.locked, c.locked),
        spotBorrow: sumStrField(prev.spotBorrow, c.spotBorrow),
      });
    }
  }
  const sumEntry = (field: keyof BybitWalletEntry) =>
    entries.reduce((acc, e) => acc + (toNum(e[field] as string | undefined) ?? 0), 0);
  return {
    totalEquity: String(sumEntry('totalEquity')),
    totalWalletBalance: String(sumEntry('totalWalletBalance')),
    totalAvailableBalance: String(sumEntry('totalAvailableBalance')),
    totalMarginBalance: String(sumEntry('totalMarginBalance')),
    totalInitialMargin: String(sumEntry('totalInitialMargin')),
    totalPerpUPL: String(sumEntry('totalPerpUPL')),
    coin: [...coinMap.values()],
  };
}

/** Locked margin / collateral in unified account (USD terms from Bybit). */
function computeUnifiedMarginInUseUsd(unified: AccountBucketSnapshot | undefined): number | null {
  if (!unified) return null;
  const im = unified.metrics.marginUsed;
  if (im != null && Number.isFinite(im) && im >= 0) return im;
  const w = unified.metrics.walletBalance ?? unified.metrics.equity;
  const a = unified.metrics.availableBalance;
  if (w != null && a != null && Number.isFinite(w) && Number.isFinite(a)) {
    const d = w - a;
    return Number.isFinite(d) ? Math.max(0, d) : null;
  }
  return null;
}

/**
 * Primary line for Funding overview: use *transfer-eligible* balance (Bybit `transferBalance`, mapped to
 * `BalanceItem.free`), not `walletBalance` totals. After moving funds to UTA, wallet/bonus lines can
 * still be non-zero while transferable is 0 — that mismatch confused users seeing e.g. $70 in Funding.
 */
function resolveFundingPrimary(bucket: AccountBucketSnapshot | undefined): { amount: number; asset: string } | null {
  if (!bucket || bucket.kind !== 'funding') return null;
  const byFreeDesc = [...bucket.assets].sort((a, b) => b.free - a.free);

  for (const sym of ['USDT', 'USDC', 'USD'] as const) {
    const row = bucket.assets.find((a) => a.asset === sym);
    if (row && Number.isFinite(row.free) && row.free > 0) {
      return { amount: row.free, asset: sym };
    }
  }
  for (const row of byFreeDesc) {
    if (Number.isFinite(row.free) && row.free > 0) {
      return { amount: row.free, asset: row.asset };
    }
  }
  for (const sym of ['USDT', 'USDC', 'USD'] as const) {
    const row = bucket.assets.find((a) => a.asset === sym);
    if (row && Number.isFinite(row.free)) {
      return { amount: Math.max(0, row.free), asset: sym };
    }
  }
  if (byFreeDesc.length > 0) {
    const row = byFreeDesc[0];
    return { amount: Math.max(0, row.free), asset: row.asset };
  }
  return null;
}

export class BybitAdapter implements ExchangeAdapter {
  readonly id = 'bybit' as const;

  async validateReadOnly(input: ConnectInput): Promise<ValidationResult> {
    const result = await privateGet<BybitQueryApiResult>('/v5/user/query-api', {}, input);
    const permission = parsePermission(result);
    if (permission.withdrawalsEnabled) {
      return { ok: false, message: 'Withdrawals must be disabled for this integration.', permission };
    }
    if (!permission.canReadBalances && !permission.canReadPositions) {
      return {
        ok: false,
        message: 'API key needs Wallet and/or Contract (or Spot) permissions for portfolio sync.',
        permission,
      };
    }
    const msg = permission.readOnly
      ? 'Bybit key validated (read-only mode).'
      : 'Bybit key validated (read/write). Sigflo syncs balances and positions only; it does not submit orders yet.';
    return { ok: true, message: msg, permission };
  }

  private async fetchWalletBucket(input: ConnectInput, accountType: 'SPOT' | 'CONTRACT') {
    try {
      const result = await privateGet<BybitWalletBalanceResult>(
        '/v5/account/wallet-balance',
        { accountType },
        input,
      );
      const list = result.list ?? [];
      if (list.length === 0) return null;
      return mergeWalletEntries(list);
    } catch {
      return null;
    }
  }

  /**
   * Funding wallet: Bybit documents `/v5/account/wallet-balance` for UNIFIED only; FUND balances
   * must be read via `query-account-coins-balance`.
   */
  private async fetchFundingWallet(input: ConnectInput): Promise<BybitWalletEntry | null> {
    try {
      const result = await privateGet<QueryAccountCoinsBalanceResult>(
        '/v5/asset/transfer/query-account-coins-balance',
        { accountType: 'FUND', withBonus: '1' },
        input,
      );
      const rows = result.balance ?? [];
      if (rows.length === 0) return null;
      const coin: BybitWalletCoin[] = rows.map((r) => ({
        coin: r.coin,
        walletBalance: r.walletBalance,
        transferBalance: r.transferBalance,
        bonus: r.bonus,
      }));
      return { coin };
    } catch {
      return null;
    }
  }

  private async fetchUnifiedWallet(input: ConnectInput): Promise<BybitWalletEntry | null> {
    try {
      const result = await privateGet<BybitWalletBalanceResult>(
        '/v5/account/wallet-balance',
        { accountType: 'UNIFIED' },
        input,
      );
      const list = result.list ?? [];
      if (list.length === 0) return null;
      return mergeWalletEntries(list);
    } catch {
      return null;
    }
  }

  async fetchBalances(input: ConnectInput): Promise<BalanceItem[]> {
    const breakdown = await this.fetchAccountBreakdown(input);
    if (!breakdown) return [];
    const unified = breakdown.buckets.find((b) => b.kind === 'unified');
    return unified?.assets ?? breakdown.buckets.flatMap((b) => b.assets);
  }

  async fetchAccountBreakdown(input: ConnectInput): Promise<ExchangeAccountBreakdown | null> {
    const [unifiedEntry, fundingEntry, spotEntry, contractEntry] = await Promise.all([
      this.fetchUnifiedWallet(input),
      this.fetchFundingWallet(input),
      this.fetchWalletBucket(input, 'SPOT'),
      this.fetchWalletBucket(input, 'CONTRACT'),
    ]);

    const bucketEntries: Array<[AccountBucketKind, BybitWalletEntry | null]> = [
      ['unified', unifiedEntry],
      ['funding', fundingEntry],
      ['spot', spotEntry],
      ['derivatives', contractEntry],
    ];
    const bucketsRaw = bucketEntries
      .filter(([, entry]) => entry != null)
      .map(([kind, entry]) => toBucketSnapshot(kind, entry as BybitWalletEntry))
      .filter((b) => b.assets.length > 0 || Object.values(b.metrics).some((n) => n != null));

    const buckets = sortBuckets(bucketsRaw);

    if (buckets.length === 0) return null;

    const primary = buckets.find((b) => b.kind === 'unified') ?? buckets[0];
    const unifiedBucket = buckets.find((b) => b.kind === 'unified');
    const fundingBucket = buckets.find((b) => b.kind === 'funding');
    const unifiedMarginInUseUsd = computeUnifiedMarginInUseUsd(unifiedBucket);
    const totalWalletBalance =
      primary.metrics.walletBalance ?? buckets.reduce((sum, b) => sum + (b.metrics.walletBalance ?? 0), 0);
    const totalEquity =
      primary.metrics.equity ?? buckets.reduce((sum, b) => sum + (b.metrics.equity ?? 0), 0);
    const availableToTrade =
      unifiedBucket?.metrics.availableBalance ??
      primary.metrics.availableBalance ??
      buckets
        .filter((b) => b.kind === 'unified' || b.kind === 'derivatives' || b.kind === 'spot')
        .reduce((sum, b) => sum + (b.metrics.availableBalance ?? 0), 0);

    const fundingPrimary = resolveFundingPrimary(fundingBucket);

    return {
      overview: {
        totalEquity: Number.isFinite(totalEquity) ? totalEquity : null,
        totalWalletBalance: Number.isFinite(totalWalletBalance) ? totalWalletBalance : null,
        availableToTrade: Number.isFinite(availableToTrade) ? availableToTrade : null,
        unifiedMarginInUseUsd:
          unifiedMarginInUseUsd != null && Number.isFinite(unifiedMarginInUseUsd) ? unifiedMarginInUseUsd : null,
        fundingWalletBalance:
          fundingPrimary != null && Number.isFinite(fundingPrimary.amount) ? fundingPrimary.amount : null,
        fundingPrimaryAsset: fundingPrimary != null ? fundingPrimary.asset : null,
      },
      buckets,
    };
  }

  async fetchPositions(input: ConnectInput): Promise<PositionItem[]> {
    const result = await privateGet<{
      list?: Array<{
        symbol: string;
        side: string;
        size: string;
        avgPrice: string;
        markPrice?: string;
        unrealisedPnl?: string;
        leverage?: string;
        positionIM?: string;
        liqPrice?: string;
        positionIdx?: number;
        takeProfit?: string;
        stopLoss?: string;
        createdTime?: string;
      }>;
    }>('/v5/position/list', { category: 'linear', settleCoin: 'USDT' }, input);
    const parsePositionTpSl = (raw: string | undefined): number | undefined => {
      if (raw == null) return undefined;
      const t = String(raw).trim();
      if (t === '' || t === '0' || t === '0.0' || t === '0.00') return undefined;
      const n = Number(t);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };

    return (result.list ?? [])
      .map((p) => {
        const tp = parsePositionTpSl(p.takeProfit);
        const sl = parsePositionTpSl(p.stopLoss);
        const liq = p.liqPrice != null && String(p.liqPrice).trim() !== '' ? Number(p.liqPrice) : NaN;
        const createdMs = Number(p.createdTime ?? 0);
        return {
          symbol: p.symbol,
          side: (String(p.side).toLowerCase() === 'sell' ? 'short' : 'long') as 'short' | 'long',
          size: Number(p.size ?? 0),
          entryPrice: Number(p.avgPrice ?? 0),
          markPrice: Number(p.markPrice ?? 0),
          unrealizedPnl: Number(p.unrealisedPnl ?? 0),
          leverage: Number(p.leverage ?? 0) || undefined,
          positionIM: Number(p.positionIM ?? 0) || undefined,
          liqPrice: Number.isFinite(liq) && liq > 0 ? liq : undefined,
          positionIdx: typeof p.positionIdx === 'number' ? p.positionIdx : Number(p.positionIdx ?? 0),
          takeProfitPrice: tp,
          stopLossPrice: sl,
          openedAtMs: Number.isFinite(createdMs) && createdMs > 0 ? createdMs : undefined,
        };
      })
      .filter((p) => p.size > 0);
  }

  /** Throws if Bybit marks the key as read-only (`readOnly === 1`). */
  async ensureTradeEnabled(input: ConnectInput): Promise<void> {
    const r = await privateGet<BybitQueryApiResult>('/v5/user/query-api', {}, input);
    if (r.readOnly === 1) {
      throw new Error('This API key is read-only on Bybit. Use a read/write key to place orders from Sigflo.');
    }
  }

  async setLinearLeverage(input: ConnectInput, symbol: string, leverage: number): Promise<void> {
    const lev = Math.min(200, Math.max(1, Math.round(leverage)));
    await privatePost<Record<string, unknown>>(
      '/v5/position/set-leverage',
      {
        category: 'linear',
        symbol: symbol.toUpperCase(),
        buyLeverage: String(lev),
        sellLeverage: String(lev),
      },
      input,
    );
  }

  async placeLinearOrder(
    input: ConnectInput,
    params: BybitLinearOrderParams,
  ): Promise<{ orderId: string; orderLinkId?: string }> {
    const sym = params.symbol.toUpperCase();
    const positionIdx = params.positionIdx ?? 0;
    let qty = String(params.qty).trim();
    const lot = await fetchLotSizeFilter('linear', sym);
    if (lot?.qtyStep && lot.minOrderQty != null && lot.maxOrderQty != null) {
      qty = normalizeQtyToStep(qty, lot.qtyStep, lot.minOrderQty, lot.maxOrderQty);
    }
    const body: Record<string, unknown> = {
      category: 'linear',
      symbol: sym,
      side: params.side,
      orderType: params.orderType,
      qty,
      positionIdx,
      reduceOnly: params.reduceOnly === true,
    };
    if (params.orderType === 'Limit') {
      if (params.price == null || String(params.price).trim() === '') {
        throw new Error('Limit orders require a price');
      }
      body.price = params.price;
      body.timeInForce = 'GTC';
    } else {
      body.timeInForce = 'IOC';
    }

    const tp = params.takeProfit?.trim();
    const sl = params.stopLoss?.trim();
    if (tp || sl) {
      if (params.reduceOnly === true) {
        throw new Error('Take profit and stop loss cannot be set on reduce-only orders.');
      }
      if (tp) body.takeProfit = tp;
      if (sl) body.stopLoss = sl;
      body.tpslMode = 'Full';
      body.tpOrderType = 'Market';
      body.slOrderType = 'Market';
      body.tpTriggerBy = 'LastPrice';
      body.slTriggerBy = 'LastPrice';
    }

    return privatePost<{ orderId: string; orderLinkId?: string }>('/v5/order/create', body, input);
  }

  async placeSpotOrder(
    input: ConnectInput,
    params: BybitSpotOrderParams,
  ): Promise<{ orderId: string; orderLinkId?: string }> {
    const sym = params.symbol.toUpperCase();
    let qty = String(params.qty).trim();
    const lot = await fetchLotSizeFilter('spot', sym);
    if (params.marketUnit === 'baseCoin') {
      if (lot?.qtyStep && lot.minOrderQty != null && lot.maxOrderQty != null) {
        qty = normalizeQtyToStep(qty, lot.qtyStep, lot.minOrderQty, lot.maxOrderQty);
      }
    } else {
      const stepStr =
        lot?.quotePrecision != null && String(lot.quotePrecision).length > 0 && Number(lot.quotePrecision) > 0
          ? String(lot.quotePrecision)
          : '0.01';
      const minAmt =
        lot?.minOrderAmt != null && Number(lot.minOrderAmt) > 0 ? String(lot.minOrderAmt) : '1';
      const maxAmt =
        lot?.maxOrderAmt != null && Number(lot.maxOrderAmt) > 0 ? String(lot.maxOrderAmt) : '999999999';
      qty = normalizeQtyToStep(qty, stepStr, minAmt, maxAmt);
    }
    const body: Record<string, unknown> = {
      category: 'spot',
      symbol: sym,
      side: params.side,
      orderType: params.orderType,
      qty,
      marketUnit: params.marketUnit,
    };
    if (params.orderType === 'Limit') {
      if (params.price == null || String(params.price).trim() === '') {
        throw new Error('Limit orders require a price');
      }
      body.price = params.price;
      body.timeInForce = 'GTC';
    } else {
      body.timeInForce = 'IOC';
    }
    return privatePost<{ orderId: string; orderLinkId?: string }>('/v5/order/create', body, input);
  }

  async fetchClosedTrades(input: ConnectInput, opts?: { limit?: number }): Promise<ClosedTradeItem[]> {
    const lim = Math.min(100, Math.max(1, opts?.limit ?? 50));
    const result = await privateGet<{
      list?: Array<{ symbol: string; closedPnl: string; updatedTime: string; orderId?: string }>;
    }>('/v5/position/closed-pnl', { category: 'linear', limit: String(lim) }, input);
    const rows = result.list ?? [];
    return rows
      .map((r) => {
        const ms = Number(r.updatedTime);
        const closedAt = Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString();
        return {
          symbol: r.symbol,
          closedPnl: Number(r.closedPnl ?? 0),
          closedAt,
          orderId: r.orderId,
        };
      })
      .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  }
}
