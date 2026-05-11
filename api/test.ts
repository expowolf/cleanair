// Vercel serverless function: GET /api/test
// Confirms env vars are loaded server-side without leaking secret values.
// Usage: open https://YOUR-APP.vercel.app/api/test in a browser.

export const config = { runtime: 'edge' };

export default function handler() {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  return new Response(
    JSON.stringify({
      ok: true,
      env: {
        OPENROUTER_API_KEY: hasOpenRouter ? `present (${process.env.OPENROUTER_API_KEY!.length} chars)` : 'MISSING',
        NVIDIA_API_KEY: hasNvidia ? `present (${process.env.NVIDIA_API_KEY!.length} chars)` : 'MISSING',
        OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini (default)',
      },
      timestamp: new Date().toISOString(),
    }, null, 2),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
