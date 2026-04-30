// OpenRouter AI client. Uses VITE_OPENROUTER_API_KEY (preferred) or falls back
// to OPENROUTER_API_KEY substituted at build time by vite.config.ts.
const apiKey =
  (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined) ||
  (typeof process !== 'undefined' && (process as any).env?.OPENROUTER_API_KEY) ||
  '';

const model =
  (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) ||
  (typeof process !== 'undefined' && (process as any).env?.OPENROUTER_MODEL) ||
  'anthropic/claude-sonnet-4-5';

export const isAIAvailable = () => !!apiKey;

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function aiChat(messages: Msg[], opts: { json?: boolean; maxTokens?: number } = {}): Promise<string> {
  if (!apiKey) throw new Error('OpenRouter API key missing. Set VITE_OPENROUTER_API_KEY.');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
      'X-Title': 'CleanAIr',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 600,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function aiJSON<T>(messages: Msg[], maxTokens = 800): Promise<T> {
  const text = await aiChat(messages, { json: true, maxTokens });
  return JSON.parse(text) as T;
}

// ---- Coping suggestion for a craving ----
export async function generateCravingSuggestion(args: {
  intensity: number;
  trigger: string | null;
  nicotineType?: string;
}): Promise<{ suggestion: string; reason: string }> {
  const sys = `You are CleanAIr, a no-nonsense quit-coach. Give one concrete, doable-in-2-minutes action to break a nicotine craving. Tone: direct, science-leaning, not preachy. Output ONLY JSON: {"suggestion":"...","reason":"..."}. suggestion <= 14 words, imperative. reason <= 22 words, cite the neurochemistry/physiology mechanism.`;
  const user = `Intensity: ${args.intensity}/5. Trigger: ${args.trigger ?? 'unspecified'}. Substance: ${args.nicotineType ?? 'nicotine'}. Give the suggestion.`;
  return aiJSON<{ suggestion: string; reason: string }>([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ], 250);
}
