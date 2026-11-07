import type { CONTRACT_FAILURES, ContractFailure } from '@family/shared';

/**
 * Общото на AI заявките над една рецепта (подобряване, поправка), по `lib/ai-requests.ts` на family: `POST` → `pending`,
 * клиентът пита отново, докато заявката не е `done`/`failed`; кодовете на `failed` са едни и същи. 503
 * `openclaw_unavailable` при пускане е `failureKind` `ai_unavailable` и го казва `ErrorBox`.
 */

/** Колко често се пита за заявка, която още е `pending`. */
export const POLL_INTERVAL_MS = 3000;

/** Какво е поискано от AI: подобряване („Подобри рецептата“) или поправка („Поправи с AI“) на рецепта. */
export type AiRequestKind = 'refine' | 'revise';

/** Полетата на заявката, от които зависи съобщението; общи за всички AI заявки. */
export interface FailedAiRequest {
  error?: ContractFailure | undefined;
  createdAt: string;
  finishedAt?: string | undefined;
}

/** Какво AI не е успяло да направи и какво може човекът оттук. */
const KINDS: Record<AiRequestKind, { failed: string; next: string }> = {
  refine: { failed: 'AI не успя да подобри рецептата', next: 'Опитай пак.' },
  revise: { failed: 'AI не успя да поправи рецептата', next: 'Опитай пак.' },
};

type NamedFailure = (typeof CONTRACT_FAILURES)[number];

/** Кодовете, чийто текст казва сам и причината, и действието. */
const OWN_MESSAGES: Partial<
  Record<NamedFailure, Partial<Record<AiRequestKind, string>>>
> = {
  no_results: {
    refine: 'Рецептата вече е наред.',
    revise: 'Няма какво да се поправи.',
  },
};

const MINUTE_MS = 60_000;

function isHttpFailure(
  error: ContractFailure,
): error is Extract<ContractFailure, `http_${number}`> {
  return error.startsWith('http_');
}

/** „3 минути“, „1 минута“, под минута — „40 секунди“. */
function waited(ms: number): string {
  if (ms < MINUTE_MS) {
    const seconds = Math.max(1, Math.round(ms / 1000));
    return seconds === 1 ? '1 секунда' : `${seconds} секунди`;
  }
  const minutes = Math.round(ms / MINUTE_MS);
  return minutes === 1 ? '1 минута' : `${minutes} минути`;
}

/** Причината, преди действието: изречение без точка. */
function reason(kind: AiRequestKind, request?: FailedAiRequest): string {
  const error = request?.error;
  if (request && error === 'timeout') {
    if (request.finishedAt === undefined) {
      return 'AI не отговори навреме';
    }
    const ms = Date.parse(request.finishedAt) - Date.parse(request.createdAt);
    return `AI не отговори за ${waited(ms)}`;
  }
  if (error === 'invalid_output') {
    return 'AI върна отговор, който не мога да прочета';
  }
  if (error !== undefined && isHttpFailure(error)) {
    return 'AI не е на разположение в момента';
  }
  if (error === 'stale') {
    return `${KINDS[kind].failed}: сървърът се рестартира междувременно`;
  }
  if (error === 'aborted') {
    return `${KINDS[kind].failed}: заявката беше прекъсната`;
  }
  return KINDS[kind].failed;
}

/**
 * Съобщение за неуспешна AI заявка: какво не е станало и какво може човекът, без кодове. `timeout` казва колко е
 * чакано (`createdAt` → `finishedAt`).
 */
export function failureMessage(
  kind: AiRequestKind,
  request?: FailedAiRequest,
): string {
  const error = request?.error;
  const own =
    error === undefined || isHttpFailure(error)
      ? undefined
      : OWN_MESSAGES[error]?.[kind];
  return own ?? `${reason(kind, request)}. ${KINDS[kind].next}`;
}
