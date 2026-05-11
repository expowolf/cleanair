// Browser-side AI client. Calls our own /api/chat Vercel serverless function,
// which proxies to OpenRouter using a server-side OPENROUTER_API_KEY — the
// key never reaches the user's browser.

const PROXY_URL = '/api/chat';

// AI is "available" as long as we're running in a browser; the server validates
// the key at request time and returns a clear error if it's missing.
export const isAIAvailable = () => typeof window !== 'undefined';

if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[CleanAIr/AI] proxy mode enabled — using', PROXY_URL);
  (window as any).__cleanair_ai = { mode: 'proxy', endpoint: PROXY_URL };
}

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function aiChat(
  messages: Msg[],
  opts: { json?: boolean; maxTokens?: number; model?: string } = {}
): Promise<string> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      json: !!opts.json,
      maxTokens: opts.maxTokens ?? 800,
      model: opts.model,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[CleanAIr/AI] proxy error', res.status, text);
    throw new Error(`AI proxy ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// Returns parsed JSON; tolerates models that wrap JSON in markdown fences.
export async function aiJSON<T>(messages: Msg[], maxTokens = 800): Promise<T> {
  const text = await aiChat(messages, { json: true, maxTokens });
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
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
