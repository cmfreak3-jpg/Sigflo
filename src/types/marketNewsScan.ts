export type MarketNewsArticle = {
  id: number;
  title: string;
  link: string;
  source: string;
  published: string;
  excerpt: string;
};

export type MarketNewsAssetFocus = {
  symbol: string;
  newsRelevance: 'high' | 'medium' | 'low' | 'none';
  narrative: string;
  technicalVsNews: string;
};

export type MarketNewsSummary = {
  marketMood: string;
  keyDrivers: string[];
  assetsAffected: { symbol: string; note: string }[];
  whyItMatters: string;
  whatToWatchNext: string[];
  sourcesReferenced: number[];
  lowSignalSummary: boolean;
  assetFocus: MarketNewsAssetFocus | null;
  fullBrief?: string;
};

export type MarketNewsScanResult = {
  ok: boolean;
  error?: string;
  noAi?: boolean;
  lowSignal?: boolean;
  message?: string;
  mode: 'short' | 'deep';
  focusAsset: string | null;
  summary: MarketNewsSummary | null;
  articles: MarketNewsArticle[];
};
