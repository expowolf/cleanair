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
// Cache the most recently successful model. Free models flicker in and out
// of availability — once we find one that works, stick with it instead of
// rolling the dice every request.
let LAST_GOOD_MODEL: { id: string; at: number } | null = null;
const LAST_GOOD_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

  // Reorder live catalog to prefer small/fast free models first. Big 70B+
  // models on free tier are notoriously slow and often time out.
  const FAST_PATTERNS = [
    /llama-3\.2-3b/i, /llama-3\.1-8b/i, /gemma-2-9b/i, /qwen.*7b/i,
    /mistral-7b/i, /phi-3/i, /gemini-flash/i,
  ];
  const fast = live.filter((id) => FAST_PATTERNS.some((re) => re.test(id)));
  const rest = live.filter((id) => !fast.includes(id));
  const prioritizedLive = [...fast, ...rest];

  const chain: string[] = [];
  if (requested) chain.push(requested);
  if (envModel && !chain.includes(envModel)) chain.push(envModel);
  // The last model that actually worked is the strongest predictor of the
  // next success — it lives near the front of the race.
  if (LAST_GOOD_MODEL && Date.now() - LAST_GOOD_MODEL.at < LAST_GOOD_TTL_MS && !chain.includes(LAST_GOOD_MODEL.id)) {
    chain.push(LAST_GOOD_MODEL.id);
  }
  for (const id of prioritizedLive) if (!chain.includes(id)) chain.push(id);
  // Race 4 models in parallel — first one to respond wins.
  const modelChain = chain.slice(0, 4);

  if (modelChain.length === 0) {
    return json({ error: 'No models available. OpenRouter catalog returned empty list.' }, 502);
  }

  const origin = req.headers.get('origin') || 'https://cleanair.app';

  // Race models in parallel — whichever returns first wins, the rest abort.
  // This keeps us safely under Vercel's 25s Edge limit even if some free
  // models are completely unresponsive (sequential retries used to hit 504).
  const controllers = modelChain.map(() => new AbortController());
  const PER_REQUEST_TIMEOUT = 14000;
  const timers = controllers.map((c) => setTimeout(() => c.abort(), PER_REQUEST_TIMEOUT));
  const triedSummary: { model: string; status: number }[] = [];

  const attempts = modelChain.map((model, idx) => {
    const openrouterBody: Record<string, unknown> = {
      model,
      messages: body.messages,
      max_tokens: Math.min(body.maxTokens ?? 800, 1800),
      temperature: 0.7,
      stream: !!body.stream,
    };
    const supportsJsonMode = /openai|anthropic|google\/gemini-(1\.5|2)/i.test(model);
    if (body.json && !body.stream && supportsJsonMode) {
      openrouterBody.response_format = { type: 'json_object' };
    }

    console.log(`[api/chat] → race model=${model}`);

    return fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': origin,
        'X-Title': 'CleanAIr',
      },
      body: JSON.stringify(openrouterBody),
      signal: controllers[idx].signal,
    }).then(async (res) => {
      if (!res.ok) {
        const txt = await res.text();
        triedSummary.push({ model, status: res.status });
        if (res.status === 404) MODEL_CACHE = null;
        throw new Error(`${model} ${res.status}: ${txt.slice(0, 200)}`);
      }
      return { model, res };
    });
  });

  let winner: { model: string; res: Response };
  try {
    winner = await Promise.any(attempts);
  } catch (err: any) {
    timers.forEach(clearTimeout);
    controllers.forEach((c) => { try { c.abort(); } catch {} });
    const messages = (err?.errors || []).map((e: Error) => e.message).join(' | ');
    console.error('[api/chat] all racers failed:', messages);
    return json(
      { error: 'All AI models failed.', tried: triedSummary, lastError: messages.slice(0, 500) },
      502
    );
  }

  // Abort the losing requests so upstream connections close promptly.
  controllers.forEach((c, i) => { if (modelChain[i] !== winner.model) { try { c.abort(); } catch {} } });
  timers.forEach(clearTimeout);

  const upstream = winner.res;
  const usedModel = winner.model;
  LAST_GOOD_MODEL = { id: usedModel, at: Date.now() };
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
