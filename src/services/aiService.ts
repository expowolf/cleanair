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

// Free LLMs sometimes emit slightly malformed JSON (trailing commas, smart quotes,
// truncation mid-object). This repairs common issues before JSON.parse.
function repairJSON(s: string): string {
  let t = s.trim();
  // Strip markdown fences if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  // Locate first { or [ — drop any leading prose.
  const firstObj = t.indexOf('{');
  const firstArr = t.indexOf('[');
  const start =
    firstObj === -1 ? firstArr :
    firstArr === -1 ? firstObj :
    Math.min(firstObj, firstArr);
  if (start > 0) t = t.slice(start);
  // Normalize smart quotes.
  t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // Walk the string and track quote/brace state. If the model stopped
  // mid-string, truncate back to the last clean position and append the
  // closers needed to make valid JSON.
  let inString = false;
  let escape = false;
  let lastSafe = -1; // index of last char that's safe to truncate after
  const stack: string[] = []; // tracks open {/[ for balancing
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = false; lastSafe = i; }
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{' || c === '[') { stack.push(c); lastSafe = i; }
    else if (c === '}' || c === ']') { stack.pop(); lastSafe = i; }
    else if (c === ',' || c === ':' || /\s/.test(c)) { lastSafe = i; }
    else { lastSafe = i; }
  }

  // If we ended inside an unterminated string, truncate back to the last safe spot.
  if (inString && lastSafe >= 0) {
    t = t.slice(0, lastSafe + 1);
    // Recount stack on truncated text.
    stack.length = 0;
    let s2 = false, e2 = false;
    for (const c of t) {
      if (s2) {
        if (e2) { e2 = false; continue; }
        if (c === '\\') { e2 = true; continue; }
        if (c === '"') s2 = false;
        continue;
      }
      if (c === '"') s2 = true;
      else if (c === '{' || c === '[') stack.push(c);
      else if (c === '}' || c === ']') stack.pop();
    }
  }

  // Trim trailing comma that would leave a dangling element.
  t = t.replace(/,\s*$/, '');
  // Remove trailing commas before } or ].
  t = t.replace(/,(\s*[}\]])/g, '$1');

  // Append the closers in correct reverse order.
  while (stack.length) {
    const open = stack.pop()!;
    t += open === '{' ? '}' : ']';
  }
  return t;
}

// Returns parsed JSON; tolerates models that wrap JSON in markdown fences,
// trailing commas, smart quotes, and truncation.
export async function aiJSON<T>(messages: Msg[], maxTokens = 800): Promise<T> {
  const text = await aiChat(messages, { json: true, maxTokens });
  const cleaned = repairJSON(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error('aiJSON parse failed. Repaired:', cleaned.slice(0, 500), '\nRaw response:', text);
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
  const sys = `You are CleanAIr, an evidence-based quit-coach. Output ONLY a JSON object, no prose. Schema:
{"title":"<=6 words tied to user's goal","whyItMatters":"1 sentence","tasks":[{"id":"t1","title":"<=6 words SEARCHABLE skill","description":"1 sentence","timeSlot":"Morning","category":"exercise|mindfulness|habit|learning|productivity"}],"habitReplacements":[{"trigger":"...","suggestion":"<=10 words"}],"cravingResponsePlan":["s1","s2","s3"],"milestones":[{"title":"<=4 words","targetDays":3}]}
Rules: exactly 3 tasks (Morning/Midday/Evening), 3 habitReplacements, 3 cravingResponsePlan, 4 milestones at days 3/7/14/30.
TASK TITLES must be specific YouTube-searchable activities from the GOAL'S domain. Bad: "Skill Building". Good for "build a drift car": "MIG Welding Basics Tutorial". Good for "write a book": "Three Act Structure Outline". Be concrete.`;
  const goalLine = args.goal.length > 200 ? args.goal.slice(0, 200) + '...' : args.goal;
  const user = `Goal: ${goalLine}
Substance: ${args.profile.nicotineType ?? 'nicotine'}
Why: ${(args.profile.whyIQuit ?? 'health').slice(0, 80)}
Triggers: ${(args.profile.triggers || []).slice(0, 3).join(', ') || 'unspecified'}`;
  // Retry once on failure — free models occasionally truncate or time out on
  // the first try but succeed on the second with smaller max_tokens.
  try {
    return await aiJSON([
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], 1200);
  } catch (e) {
    console.warn('[CleanAIr/AI] plan retry after error:', (e as Error).message);
    return aiJSON([
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], 900);
  }
}
