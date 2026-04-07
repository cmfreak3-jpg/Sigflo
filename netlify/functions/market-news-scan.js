import { ensureRootEnvLoaded } from './lib/load-root-env.mjs';
import { runMarketNewsScan } from './lib/market-news-scan-core.mjs';

export const handler = async (event) => {
  ensureRootEnvLoaded();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204 };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const result = await runMarketNewsScan(event.body, process.env);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
};
