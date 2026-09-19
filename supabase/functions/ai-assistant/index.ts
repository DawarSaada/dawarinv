/**
 * ai-assistant — server-side OpenRouter proxy.
 *
 * The browser never sees the OpenRouter key: it calls this function through
 * `supabase.functions.invoke('ai-assistant', ...)`, which requires a valid
 * Supabase JWT (verify_jwt is on by default) and then relays one
 * /chat/completions request.
 *
 * Required secret:  OPENROUTER_API_KEY
 * Optional secrets:
 *   OPENROUTER_MODEL        primary model slug (default below)
 *   OPENROUTER_MODELS       comma-separated allowlist the client may pick from
 *   OPENROUTER_FALLBACKS    comma-separated models OpenRouter may fall back to
 *   OPENROUTER_APP_URL      sent as HTTP-Referer (OpenRouter attribution/rank)
 *   OPENROUTER_APP_TITLE    sent as X-Title
 *   OPENROUTER_DENY_DATA_COLLECTION  'true' to only route to providers that do not
 *                                    train on / retain prompts
 *   ALLOWED_ORIGINS         comma separated browser origins allowed to call this
 *   AI_MAX_TOKENS           output cap (default 2048)
 *   AI_TIMEOUT_MS           upstream timeout (default 60000)
 *
 * Deploy with:
 *   supabase functions deploy ai-assistant
 *   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
 *
 * Verify with (returns the configured status, no prompt needed):
 *   curl -s -X GET "$SUPABASE_URL/functions/v1/ai-assistant" \
 *     -H "Authorization: Bearer $SUPABASE_ANON_KEY"
 */

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_PROMPT_CHARS = 120_000;
const MAX_IMAGES = 4;
/** OpenRouter accepts data: URLs; anything larger is almost certainly a mistake. */
const MAX_IMAGE_CHARS = 6_000_000;

const env = (key: string) => Deno.env.get(key)?.trim() || '';

const csv = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const allowedOrigins = csv(env('ALLOWED_ORIGINS') || 'http://localhost:3000,http://localhost:5199');

const primaryModel = env('OPENROUTER_MODEL') || DEFAULT_MODEL;
const allowlist = Array.from(new Set([primaryModel, ...csv(env('OPENROUTER_MODELS'))]));
const fallbacks = csv(env('OPENROUTER_FALLBACKS'));

const maxTokens = Number(env('AI_MAX_TOKENS')) || 2048;
const timeoutMs = Number(env('AI_TIMEOUT_MS')) || 60_000;

const corsHeadersFor = (origin: string | null): Record<string, string> => {
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allowed,
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
};

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' },
  });

interface AiAssistantRequest {
  prompt?: unknown;
  /** Optional system instruction (kept separate so callers can set the persona). */
  system?: unknown;
  /** Optional data: URLs (jpg/png/webp) for vision-capable models. */
  images?: unknown;
  /** Standard JSON Schema (draft-07 style). Enables JSON output mode. */
  responseSchema?: unknown;
  temperature?: unknown;
  model?: unknown;
  maxTokens?: unknown;
}

type MessageContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

interface ChatMessage {
  role: 'system' | 'user';
  content: MessageContent;
}

const isSchemaObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(origin) });
  }

  const apiKey = env('OPENROUTER_API_KEY');

  // Status probe: lets the app show whether AI features are usable.
  if (req.method === 'GET') {
    return json(
      {
        configured: Boolean(apiKey),
        provider: 'openrouter',
        model: primaryModel,
        models: allowlist,
        fallbacks,
        capabilities: ['text', 'json', 'vision'],
      },
      200,
      origin
    );
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed', message: 'Use POST to send a prompt.' }, 405, origin);
  }

  if (!apiKey) {
    return json(
      {
        error: 'ai_not_configured',
        message: 'OPENROUTER_API_KEY is not set for this project.',
      },
      503,
      origin
    );
  }

  let body: AiAssistantRequest;
  try {
    body = (await req.json()) as AiAssistantRequest;
  } catch {
    return json({ error: 'invalid_json', message: 'Request body must be JSON.' }, 400, origin);
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return json({ error: 'invalid_prompt', message: 'A non-empty prompt is required.' }, 400, origin);
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json(
      {
        error: 'prompt_too_large',
        message: `Prompt exceeds ${MAX_PROMPT_CHARS} characters. Send a smaller slice of data.`,
      },
      413,
      origin
    );
  }

  const requestedModel = typeof body.model === 'string' ? body.model.trim() : '';
  if (requestedModel && !allowlist.includes(requestedModel)) {
    return json(
      {
        error: 'model_not_allowed',
        message: `Model "${requestedModel}" is not enabled for this project.`,
        models: allowlist,
      },
      400,
      origin
    );
  }

  const images = Array.isArray(body.images)
    ? body.images.filter((image): image is string => typeof image === 'string' && image.startsWith('data:'))
    : [];
  if (images.length > MAX_IMAGES) {
    return json({ error: 'too_many_images', message: `At most ${MAX_IMAGES} images per request.` }, 400, origin);
  }
  if (images.some((image) => image.length > MAX_IMAGE_CHARS)) {
    return json({ error: 'image_too_large', message: 'Each image must be smaller than ~4MB.' }, 413, origin);
  }

  const schema = isSchemaObject(body.responseSchema) ? body.responseSchema : null;
  const systemPrompt = typeof body.system === 'string' ? body.system.trim() : '';

  const messages: ChatMessage[] = [];
  if (systemPrompt || schema) {
    const parts = [systemPrompt];
    if (schema) {
      parts.push(
        'Respond with a single valid JSON object and nothing else — no markdown fences, no commentary. ' +
          'It must satisfy this JSON Schema:\n' +
          JSON.stringify(schema)
      );
    }
    messages.push({ role: 'system', content: parts.filter(Boolean).join('\n\n') });
  }

  messages.push({
    role: 'user',
    content: images.length
      ? [{ type: 'text', text: prompt }, ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } }))]
      : prompt
  });

  const model = requestedModel || primaryModel;
  const temperature = typeof body.temperature === 'number' ? body.temperature : undefined;
  const tokenBudget =
    typeof body.maxTokens === 'number' && body.maxTokens > 0
      ? Math.min(Math.floor(body.maxTokens), 8192)
      : maxTokens;

  const buildPayload = (useJsonMode: boolean, useFallbacks: boolean): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: tokenBudget
    };
    if (temperature !== undefined) payload.temperature = temperature;
    if (useJsonMode) payload.response_format = { type: 'json_object' };
    if (useFallbacks && fallbacks.length > 0) {
      payload.models = [model, ...fallbacks];
      payload.route = 'fallback';
    }
    if (env('OPENROUTER_DENY_DATA_COLLECTION') === 'true') {
      payload.provider = { data_collection: 'deny' };
    }
    return payload;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  if (env('OPENROUTER_APP_URL')) headers['HTTP-Referer'] = env('OPENROUTER_APP_URL');
  if (env('OPENROUTER_APP_TITLE')) headers['X-Title'] = env('OPENROUTER_APP_TITLE');

  const callUpstream = async (payload: Record<string, unknown>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      return { response, data };
    } finally {
      clearTimeout(timer);
    }
  };

  const readText = (payload: any): string => {
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part: any) => (typeof part === 'string' ? part : part?.text ?? ''))
        .join('')
        .trim();
    }
    return '';
  };

  try {
    // First attempt: ask for JSON when a schema was supplied.
    let { response, data } = await callUpstream(buildPayload(Boolean(schema), false));

    // Some models reject `response_format`; retry once without it rather than failing the feature.
    if (!response.ok && schema && response.status === 400) {
      ({ response, data } = await callUpstream(buildPayload(false, false)));
    }

    // Transient upstream trouble: retry with the configured fallback models.
    if (!response.ok && fallbacks.length > 0 && [402, 429, 500, 502, 503, 504].includes(response.status)) {
      ({ response, data } = await callUpstream(buildPayload(Boolean(schema), true)));
    }

    if (!response.ok) {
      const upstreamMessage = data?.error?.message ?? data?.message ?? 'Upstream request failed.';
      console.error('OpenRouter request failed', response.status, upstreamMessage);

      if (response.status === 401 || response.status === 403) {
        return json(
          { error: 'invalid_api_key', message: 'The OpenRouter key was rejected.' },
          502,
          origin
        );
      }
      if (response.status === 402) {
        return json(
          { error: 'ai_no_credits', message: 'The OpenRouter account is out of credits.' },
          402,
          origin
        );
      }
      if (response.status === 404) {
        return json(
          {
            error: 'model_not_available',
            message: `Model "${model}" is not available on OpenRouter.`,
            models: allowlist
          },
          502,
          origin
        );
      }
      if (response.status === 429) {
        return json({ error: 'rate_limited', message: 'Rate limited by OpenRouter. Try again shortly.' }, 429, origin);
      }
      return json({ error: 'upstream_error', message: upstreamMessage }, 502, origin);
    }

    const text = readText(data);
    if (!text) {
      return json({ error: 'empty_response', message: 'The model returned no text.' }, 502, origin);
    }

    return json(
      {
        text,
        model: data?.model ?? model,
        usage: data?.usage ?? null
      },
      200,
      origin
    );
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    console.error('ai-assistant failed', error);
    return json(
      {
        error: aborted ? 'timeout' : 'internal_error',
        message: aborted
          ? 'The AI request timed out. Try a smaller question.'
          : 'Failed to reach the AI service.'
      },
      aborted ? 504 : 500,
      origin
    );
  }
});
