// Vercel serverless function: POST /api/chat
// Server-side OpenRouter proxy. Keeps the API key off the client bundle.
//
// Strategy: pull OpenRouter's live model catalog at request time, pick a free
// model that actually exists today, and fall through to others on rate-limit.
// Avoids stale hardcoded model names that 404 when OpenRouter retires them.

export const config = { runtime: 'edge' };

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };
type ChatBody = {
  messages: ChatMsg[];
  model?: string;
  maxTokens?: number;
  json?: boolean;
  stream?: boolean;
};

type OpenRouterModel = {
  id: string;
  pricing?: { prompt?: string; completion?: string };
  context_length?: number;
};

// Cache the model list across warm invocations of the edge function.
let MODEL_CACHE: { ids: string[]; expiresAt: number } | null = null;

async function getFreeModels(apiKey: string): Promise<string[]> {
  if (MODEL_CACHE && MODEL_CACHE.expiresAt > Date.now()) return MODEL_CACHE.ids;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`models list ${res.status}`);
    const json = await res.json();
    const all: OpenRouterModel[] = json.data || [];
    // A "free" model has both prompt and completion price == "0".
    const free = all
      .filter((m) => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
      .map((m) => m.id);
    // Cache for 10 minutes.
    MODEL_CACHE = { ids: free, expiresAt: Date.now() + 10 * 60 * 1000 };
    console.log(`[api/chat] discovered ${free.length} free models`);
    return free;
  } catch (e) {
    console.error('[api/chat] could not fetch model list:', (e as Error).message);
    return [];
  }
}

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

  // Build the model chain:
  // 1. caller-requested model (if any)
  // 2. OPENROUTER_MODEL env var (if set)
  // 3. live free models discovered from OpenRouter's catalog
  const requested = body.model;
  const envModel = process.env.OPENROUTER_MODEL;
  const live = await getFreeModels(apiKey);

  const chain: string[] = [];
  if (requested) chain.push(requested);
  if (envModel && !chain.includes(envModel)) chain.push(envModel);
  for (const id of live) if (!chain.includes(id)) chain.push(id);
  // Hard cap so a runaway chain can't blow the function budget.
  const modelChain = chain.slice(0, 10);

  if (modelChain.length === 0) {
    return json({ error: 'No models available. OpenRouter catalog returned empty list.' }, 502);
  }

  const origin = req.headers.get('origin') || 'https://cleanair.app';

  let upstream: Response | null = null;
  let lastErrorText = '';
  let usedModel = '';
  const triedSummary: { model: string; status: number }[] = [];

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

    lastErrorText = await upstream.text();
    triedSummary.push({ model, status: upstream.status });
    console.error(`[api/chat] ${model} → ${upstream.status}: ${lastErrorText.slice(0, 200)}`);
    // Retry on transient / "not for this account" errors. Stop on auth or bad request.
    if (![404, 429, 502, 503].includes(upstream.status)) break;
    // Invalidate model cache if we got a 404 — the catalog may have shifted.
    if (upstream.status === 404) MODEL_CACHE = null;
  }

  if (!upstream || !upstream.ok) {
    return json(
      {
        error: 'All AI models failed.',
        tried: triedSummary,
        lastError: lastErrorText.slice(0, 500),
      },
      upstream?.status ?? 502
    );
  }
  console.log(`[api/chat] ✓ used=${usedModel}`);

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

  const data = await upstream.json();
  return json(data, 200);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
