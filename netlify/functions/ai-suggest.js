const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return json(500, { error: 'Server is missing OPENAI_API_KEY' });
  }

  try {
    const req = JSON.parse(event.body ?? '{}');
    const {
      action = 'explain',
      signal = {},
      status = 'idle',
      tradeScore = 0,
    } = req;

    const prompt = `You are a concise crypto setup assistant for Sigflo.
Return strict JSON with keys: headline, body.
Keep body under 2 short paragraphs. No markdown.

Action: ${action}
Pair: ${signal.pair ?? 'Unknown'}
Side: ${signal.side ?? 'Unknown'}
Setup type: ${signal.setupType ?? 'Unknown'}
Setup score: ${signal.setupScore ?? 'Unknown'}
Trade score: ${tradeScore}
Status: ${status}
Risk: ${signal.riskTag ?? 'Unknown'}
Watch cue: ${signal.watchCue ?? 'n/a'}
Watch next: ${signal.watchNext ?? 'n/a'}`;

    const openAiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a concise crypto setup assistant for Sigflo.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      return json(openAiRes.status, { error: 'Upstream AI request failed', details: errorText });
    }

    const data = await openAiRes.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      try {
        const parsed = JSON.parse(content.trim());
        if (typeof parsed?.headline === 'string' && typeof parsed?.body === 'string') {
          return json(200, { headline: parsed.headline, body: parsed.body });
        }
      } catch {
        // Fallback to plain text content if model returns non-JSON text.
      }
      return json(200, { headline: 'AI suggestion', body: content.trim() });
    }

    return json(502, { error: 'Unexpected AI response format' });
  } catch (error) {
    return json(500, { error: 'Proxy request failed', details: String(error) });
  }
};
