import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { Language } from '../types';

/**
 * Client for the `ai-assistant` Supabase function (OpenRouter proxy).
 *
 * The OpenRouter key lives only in the function's secrets, never in the bundle.
 * When the function is not deployed, the key is missing or the account is out of
 * credits, these helpers throw `AiUnavailableError` carrying a stable `code` so
 * callers can show a precise, translated message instead of a stack trace.
 */

export type AiErrorCode =
  | 'not_configured'
  | 'no_credits'
  | 'rate_limited'
  | 'timeout'
  | 'model_not_available'
  | 'prompt_too_large'
  | 'invalid_response'
  | 'unavailable';

export class AiUnavailableError extends Error {
  constructor(
    message: string,
    readonly code: AiErrorCode = 'unavailable',
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export interface AiRequest {
  prompt: string;
  /** Persona / task instruction, sent as the system message. */
  system?: string;
  /** Data URLs (`data:image/png;base64,...`) for vision-capable models. */
  images?: string[];
  /** Standard JSON Schema; enables JSON output mode. */
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  /** Must be one of the models the deployment enabled. */
  model?: string;
  maxTokens?: number;
}

export interface AiResult {
  text: string;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}

export interface AiStatus {
  configured: boolean;
  provider: string;
  model: string;
  models: string[];
  fallbacks?: string[];
  capabilities?: string[];
}

const CODE_MAP: Record<string, AiErrorCode> = {
  ai_not_configured: 'not_configured',
  ai_no_credits: 'no_credits',
  rate_limited: 'rate_limited',
  timeout: 'timeout',
  model_not_available: 'model_not_available',
  model_not_allowed: 'model_not_available',
  prompt_too_large: 'prompt_too_large',
  empty_response: 'invalid_response',
  upstream_error: 'unavailable',
  invalid_api_key: 'not_configured',
  internal_error: 'unavailable',
};

/** Reads the typed body the function returns alongside a non-2xx status. */
const readFailure = async (
  error: unknown
): Promise<{ code: AiErrorCode; message?: string }> => {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function' && !context.bodyUsed) {
    try {
      const payload = await context.json();
      const code = CODE_MAP[payload?.error as string] ?? 'unavailable';
      return { code, message: payload?.message ?? payload?.error };
    } catch {
      return { code: 'unavailable' };
    }
  }
  return { code: 'unavailable' };
};

/** Sends one prompt through the edge function and returns the full result. */
export const callAiResult = async (request: AiRequest): Promise<AiResult> => {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      prompt: request.prompt,
      system: request.system,
      images: request.images,
      responseSchema: request.responseSchema,
      temperature: request.temperature,
      model: request.model,
      maxTokens: request.maxTokens,
    },
  });

  if (error) {
    const failure = await readFailure(error);
    throw new AiUnavailableError(failure.message ?? error.message ?? 'AI request failed', failure.code, error);
  }

  const text = typeof data?.text === 'string' ? data.text : '';
  if (!text) {
    throw new AiUnavailableError('The AI service returned an empty response.', 'invalid_response');
  }

  return { text, model: data?.model, usage: data?.usage ?? null };
};

/** Convenience wrapper for callers that only need the text. */
export const callAi = async (request: AiRequest): Promise<string> => (await callAiResult(request)).text;

/** Like `callAi`, but parses the model output as JSON against the supplied schema. */
export const callAiForJson = async <T>(request: AiRequest): Promise<T> => {
  const text = await callAi(request);
  try {
    // Models sometimes wrap JSON in a fenced block even when told not to.
    const cleaned = text
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch (error) {
    logger.error('AI returned invalid JSON', error);
    throw new AiUnavailableError('The AI response could not be parsed.', 'invalid_response', error);
  }
};

/** Reports whether AI features are usable and which models are enabled. */
export const getAiStatus = async (): Promise<AiStatus | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('ai-assistant', { method: 'GET' });
    if (error || !data) return null;
    return data as AiStatus;
  } catch (error) {
    logger.debug('AI status probe failed', error);
    return null;
  }
};

/** Translated, user-facing copy for an AI failure. */
export const describeAiError = (error: unknown, language: Language): string => {
  const isAr = language === 'ar';
  const code = error instanceof AiUnavailableError ? error.code : 'unavailable';

  switch (code) {
    case 'not_configured':
      return isAr
        ? 'ميزات الذكاء الاصطناعي غير مُهيأة بعد. يرجى التواصل مع المدير.'
        : 'AI features are not configured yet. Please contact your administrator.';
    case 'no_credits':
      return isAr
        ? 'رصيد مزوّد الذكاء الاصطناعي منتهي. يرجى إضافة رصيد في OpenRouter.'
        : 'The AI provider account has no credits left. Top up the OpenRouter balance.';
    case 'rate_limited':
      return isAr
        ? 'الطلبات كثيرة حالياً. يرجى المحاولة بعد قليل.'
        : 'Too many AI requests right now. Try again in a moment.';
    case 'timeout':
      return isAr
        ? 'استغرق الطلب وقتاً طويلاً. جرّب سؤالاً أقصر.'
        : 'The AI request took too long. Try a shorter question.';
    case 'model_not_available':
      return isAr
        ? 'الموديل المحدد غير متاح. تحقق من إعدادات OpenRouter.'
        : 'The selected model is not available. Check the OpenRouter configuration.';
    case 'prompt_too_large':
      return isAr
        ? 'حجم البيانات كبير جداً على المساعد. جرّب تصفية الأصناف أولاً.'
        : 'That is too much data for one request. Narrow the inventory first.';
    case 'invalid_response':
      return isAr
        ? 'لم أتمكن من قراءة رد المساعد. جرّب مرة أخرى.'
        : "The assistant's response could not be read. Please try again.";
    default:
      return isAr
        ? 'تعذّر الوصول إلى المساعد الذكي حالياً.'
        : 'The AI assistant is unavailable right now.';
  }
};

/** True when the failure is worth surfacing as a configuration problem to an admin. */
export const isAiConfiguredError = (error: unknown) =>
  error instanceof AiUnavailableError && ['not_configured', 'no_credits'].includes(error.code);
