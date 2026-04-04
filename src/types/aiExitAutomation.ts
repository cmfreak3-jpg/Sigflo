export type ExitAiMode = 'manual' | 'assisted' | 'auto';

export type ExitStrategyPreset = 'protect_profit' | 'trend_follow' | 'tight_risk' | 'custom';

export type AutomationSafeguards = {
  /** Force exit guidance / auto close when unrealized loss reaches this % (negative side). */
  maxLossPct: number;
  /** Do not activate trim-style automation until unrealized gain at least this %. */
  minProfitBeforeTrimPct: number;
  allowPartialExits: boolean;
  allowFullAutoClose: boolean;
};

export type ExitAutomationActivityKind =
  | 'mode_change'
  | 'strategy_change'
  | 'exit_state'
  | 'auto_trim'
  | 'auto_close'
  | 'safeguard'
  | 'assisted_ready';

export type ExitAutomationActivityEntry = {
  id: string;
  ts: number;
  kind: ExitAutomationActivityKind;
  message: string;
};
