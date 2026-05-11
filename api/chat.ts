// Vercel serverless function: POST /api/chat
// Server-side OpenRouter proxy. Keeps the API key off the client bundle.
//
// Request body (JSON):
//   {
//     messages: [{ role: 'user'|'system'|'assistant', content: string }],
//     model?: string,           // default: env OPENROUTER_MODEL or "openai/gpt-4o-mini"
//     maxTokens?: number,       // default: 800
//     json?: boolean,           // request JSON-formatted output
//     stream?: boolean          // SSE streaming
//   }
// Response: passthrough of OpenRouter's response (JSON or text/event-stream).

export const config = { runtime: 'edge' };

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };
type ChatBody = {
  messages: ChatMsg[];
  model?: string;
  maxTokens?: number;
  json?: boolean;
  stream?: boolean;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[api/chat] OPENROUTER_API_KEY env var missing');
    return json({ error: 'Server misconfigured: OPENROUTER_API_KEY not set.' }, 500);
  }

  let body: ChatBody;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'messages[] is required.' }, 400);
  }

  // Free-tier fallback chain: when one model is rate-limited (429), try the next.
  // Caller can override by passing body.model or setting OPENROUTER_MODEL env var.
  const FREE_FALLBACKS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'google/gemma-2-9b-it:free',
    'mistralai/mistral-7b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
  ];
  const requested = body.model || process.env.OPENROUTER_MODEL;
  const modelChain = requested ? [requested, ...FREE_FALLBACKS.filter(m => m !== requested)] : FREE_FALLBACKS;

  const origin = req.headers.get('origin') || 'https://cleanair.app';

  let upstream: Response | null = null;
  let lastErrorText = '';
  let usedModel = '';

  for (const model of modelChain) {
    const openrouterBody: Record<string, unknown> = {
      model,
      messages: body.messages,
      max_tokens: body.maxTokens ?? 800,
      temperature: 0.7,
      stream: !!body.stream,
    };
    const supportsJsonMode = /openai|anthropic|google\/gemini-(1\.5|2)/i.test(model);
    if (body.json && !body.stream && supportsJsonMode) {
      openrouterBody.response_format = { type: 'json_object' };
    }

    console.log(`[api/chat] → model=${model} msgs=${body.messages.length} stream=${!!body.stream}`);

    try {
      upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': origin,
          'X-Title': 'CleanAIr',
        },
        body: JSON.stringify(openrouterBody),
      });
    } catch (err: any) {
      console.error('[api/chat] fetch threw:', err?.message || err);
      return json({ error: 'Network error reaching OpenRouter.', detail: String(err?.message || err) }, 502);
    }

    if (upstream.ok) { usedModel = model; break; }

    // Retry on rate-limit / upstream provider errors with the next model in the chain.
    lastErrorText = await upstream.text();
    console.error(`[api/chat] ${model} → ${upstream.status}: ${lastErrorText.slice(0, 200)}`);
    if (upstream.status !== 429 && upstream.status !== 502 && upstream.status !== 503) break;
  }

  if (!upstream || !upstream.ok) {
    return new Response(lastErrorText || JSON.stringify({ error: 'All models failed.' }), {
      status: upstream?.status ?? 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.log(`[api/chat] ✓ used=${usedModel}`);

  // Streaming: pipe through as text/event-stream
  if (body.stream) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  }

  // Non-streaming: return JSON as-is
  const data = await upstream.json();
  return json(data, 200);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
