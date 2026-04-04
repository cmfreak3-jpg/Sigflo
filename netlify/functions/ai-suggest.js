import { runAiSuggest } from './lib/ai-suggest-core.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204 };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const result = await runAiSuggest(event.body, process.env);
  if ('error' in result) {
    return { statusCode: 400, body: JSON.stringify({ error: result.error }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
};
