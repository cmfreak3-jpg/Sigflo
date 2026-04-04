export function runAiSuggest(
  rawBody: string | null | undefined,
  env: NodeJS.ProcessEnv,
): Promise<{ headline: string; body: string } | { error: string }>;
