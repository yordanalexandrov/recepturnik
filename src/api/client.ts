import {
  type ApiErrorCode,
  apiErrorSchema,
  parseRefusal,
  type RefusalCode,
  type RefusalOf,
} from '@family/shared';

/**
 * ADR-0003: всяко действие на Рецептурника е от името на служебния потребител Рецептурко. Id-то е фиксирано от
 * миграцията `apps/api/drizzle/0040_seed_app_user.sql` на family.
 */
export const RECEPTURKO_ID = '33333333-3333-4333-8333-333333333333';

const BASE_PATH = '/api';

/** Минимумът от Zod schema, който клиентът ползва (всяка schema от `@family/shared` го има). */
export interface Schema<T> {
  parse(input: unknown): T;
}

/**
 * Кодове на самия клиент, когато отговорът не е по договора: `http_error` — грешка, чието тяло не е по
 * `apiErrorSchema` (напр. 502 от proxy-то); `invalid_response` — 2xx с тяло извън schema-та на route-а;
 * `session_expired` — пренасочване вместо отговор: Cloudflare Access праща изтеклата сесия към входа си.
 */
export type ClientErrorCode =
  | 'http_error'
  | 'invalid_response'
  | 'session_expired';

/** fetch падна без отговор: няма връзка със сървъра. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Няма връзка със сървъра', { cause });
    this.name = 'NetworkError';
  }
}

/** Отговор от api-то, който не е успех: тяло по `apiErrorSchema` (`{ error, message, code? }`) или код на клиента. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | ClientErrorCode;
  /** Суровото тяло на отговора, за грешки с повече от `{ error, message }` (отказите с под-код, 409 с продукт). */
  readonly body: unknown;

  constructor(
    status: number,
    code: ApiErrorCode | ClientErrorCode,
    message: string,
    body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/**
 * Вид на неуспешната заявка, по който екранът решава какво да покаже:
 * - `network` — няма връзка със сървъра;
 * - `session_expired` — Access сесията е изтекла (пренасочване, 401 или 403); презареждането води до входа;
 * - `ai_unavailable` — 503 `openclaw_unavailable`: AI не е на разположение;
 * - `server` — друг 5xx: същата заявка може да мине след малко;
 * - `client` — 4xx с `code` (`ApiError.code`, отказите — `refusalOf`): същата заявка няма да мине без промяна.
 */
export type FailureKind =
  | 'network'
  | 'session_expired'
  | 'ai_unavailable'
  | 'server'
  | 'client';

export function failureKind(error: unknown): FailureKind {
  if (!(error instanceof ApiError)) {
    return 'network';
  }
  if (
    error.code === 'session_expired' ||
    error.status === 401 ||
    error.status === 403
  ) {
    return 'session_expired';
  }
  if (error.code === 'openclaw_unavailable') {
    return 'ai_unavailable';
  }
  return error.status >= 500 ? 'server' : 'client';
}

/** Заявката може да мине, ако се повтори след малко (мрежа или 5xx). */
export function isRetryable(error: unknown): boolean {
  const kind = failureKind(error);
  return kind === 'network' || kind === 'server';
}

/**
 * Отказът с под-код `code` (`refusalSchemas` в shared, напр. `revision_open`) с детайлите му, или `null` за всяка
 * друга грешка, включително същия статус без този под-код.
 */
export function refusalOf<C extends RefusalCode>(
  error: unknown,
  code: C,
): RefusalOf<C> | null {
  return error instanceof ApiError ? parseRefusal(code, error.body) : null;
}

/** Headers на заявка с JSON тяло. */
export const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Единственият път до api-то на family: `path` е след `/api`. Добавя `X-Acting-User` на Рецептурко, проверява
 * успешния отговор със `schema` и превръща всичко друго в `NetworkError` или `ApiError` (виж `failureKind`).
 */
export async function apiFetch<T>(
  path: string,
  schema: Schema<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Acting-User', RECEPTURKO_ID);

  const url = new URL(`${BASE_PATH}${path}`, window.location.href);
  let response: Response;
  try {
    // Без `manual` браузърът следва пренасочването на Access към друг origin и fetch пада с TypeError,
    // което изглежда като липса на връзка.
    response = await fetch(url, { ...init, headers, redirect: 'manual' });
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new NetworkError(error);
  }
  if (isRedirect(response)) {
    throw new ApiError(response.status, 'session_expired', 'Сесията изтече');
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  const body: unknown = await response.json().catch(() => undefined);
  try {
    return schema.parse(body);
  } catch {
    throw new ApiError(
      response.status,
      'invalid_response',
      'Неочакван отговор от сървъра',
    );
  }
}

/** Браузърът дава `opaqueredirect` (status 0); Node и тестовете — самия 3xx. */
function isRedirect(response: Response): boolean {
  return (
    response.type === 'opaqueredirect' ||
    (response.status >= 300 && response.status < 400)
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  const raw: unknown = await response.json().catch(() => undefined);
  const body = apiErrorSchema.safeParse(raw);
  if (body.success) {
    return new ApiError(
      response.status,
      body.data.error,
      body.data.message,
      raw,
    );
  }
  return new ApiError(
    response.status,
    'http_error',
    `Сървърът отговори с грешка ${response.status}`,
    raw,
  );
}
