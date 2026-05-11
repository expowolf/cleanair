// AI client. Supports two providers — picks NVIDIA NIM when its key is set,
// falls back to OpenRouter otherwise. Configure via Vercel env vars:
//   VITE_NVIDIA_API_KEY (preferred)  + optional VITE_NVIDIA_MODEL
//   VITE_OPENROUTER_API_KEY          + optional VITE_OPENROUTER_MODEL
const env: any = (import.meta as any).env || {};

const nvidiaKey = (env.VITE_NVIDIA_API_KEY as string | undefined) || '';
const openrouterKey = (env.VITE_OPENROUTER_API_KEY as string | undefined) || '';

const provider: 'nvidia' | 'openrouter' = nvidiaKey ? 'nvidia' : 'openrouter';
const apiKey = provider === 'nvidia' ? nvidiaKey : openrouterKey;

const endpoint = provider === 'nvidia'
  ? 'https://integrate.api.nvidia.com/v1/chat/completions'
  : 'https://openrouter.ai/api/v1/chat/completions';

const model = provider === 'nvidia'
  ? ((env.VITE_NVIDIA_MODEL as string | undefined) || 'meta/llama-3.1-8b-instruct')
  : ((env.VITE_OPENROUTER_MODEL as string | undefined) || 'openai/gpt-4o-mini');

export const isAIAvailable = () => !!apiKey;

if (typeof window !== 'undefined') {
  // Status only — don't log any portion of the key.
  // eslint-disable-next-line no-console
  console.log(`[CleanAIr/AI] provider=${provider} hasKey=${!!apiKey} model=${model}`);
  (window as any).__cleanair_ai = { provider, hasKey: !!apiKey, model };
}

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function aiChat(messages: Msg[], opts: { json?: boolean; maxTokens?: number } = {}): Promise<string> {
  if (!apiKey) throw new Error('AI key missing. Set VITE_NVIDIA_API_KEY or VITE_OPENROUTER_API_KEY.');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : '';
    headers['X-Title'] = 'CleanAIr';
  }

  const body: any = {
    model,
    messages,
    max_tokens: opts.maxTokens ?? 600,
    temperature: 0.8,
    top_p: 0.95,
  };
  // NVIDIA's response_format support varies per model; only set on OpenRouter.
  if (opts.json && provider === 'openrouter') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`AI ${provider} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function aiJSON<T>(messages: Msg[], maxTokens = 800): Promise<T> {
  const text = await aiChat(messages, { json: true, maxTokens });
  // Some models wrap JSON in ```json ... ``` fences or include preamble.
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  // Extract first { ... } block as last resort
  if (cleaned[0] !== '{' && cleaned[0] !== '[') {
    const m = cleaned.match(/[{\[][\s\S]*[}\]]/);
    if (m) cleaned = m[0];
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error('aiJSON parse failed. Raw response:', text);
    throw new Error(`AI returned invalid JSON: ${(e as Error).message}`);
  }
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

// ---- Personalized quit plan ----
export async function generatePlanWithAI(args: {
  goal: string;
  profile: { nicotineType?: string; weeklySpend?: number; whyIQuit?: string; quitMethod?: string; triggers?: string[]; motivationLevel?: number };
}): Promise<{
  title: string;
  whyItMatters: string;
  tasks: { id: string; title: string; description: string; timeSlot: 'Morning' | 'Midday' | 'Evening'; category: string }[];
  habitReplacements: { trigger: string; suggestion: string }[];
  cravingResponsePlan: string[];
  milestones: { title: string; targetDays: number }[];
}> {
  const sys = `You are CleanAIr, an evidence-based quit-coach. Generate a personalized 30-day quit plan as JSON only. Schema:
{"title":"<= 6 words","whyItMatters":"1-2 sentences citing physiology/neuroscience","tasks":[{"id":"t1","title":"<= 6 words","description":"1 sentence","timeSlot":"Morning|Midday|Evening","category":"exercise|mindfulness|habit|learning|productivity"}],"habitReplacements":[{"trigger":"...","suggestion":"<= 12 words"}],"cravingResponsePlan":["step 1","step 2","step 3"],"milestones":[{"title":"<= 4 words","targetDays":3|7|14|30}]}
Constraints: exactly 3 tasks (one per timeSlot), 3 habitReplacements, 3 cravingResponsePlan steps, 4 milestones at days 3/7/14/30. Tone: direct, motivating, not preachy.`;
  const user = `Goal: ${args.goal}
Substance: ${args.profile.nicotineType ?? 'nicotine'}
Weekly spend: $${args.profile.weeklySpend ?? 0}
Why quitting: ${args.profile.whyIQuit ?? 'health'}
Method: ${args.profile.quitMethod ?? 'Cold Turkey'}
Triggers: ${args.profile.triggers?.join(', ') ?? 'unspecified'}
Motivation: ${args.profile.motivationLevel ?? 7}/10`;
  return aiJSON([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ], 1200);
}
