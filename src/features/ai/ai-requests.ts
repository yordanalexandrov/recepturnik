import type { ContractFailure, ContractRequestStatus } from '@family/shared';

/**
 * Общото на AI заявките (предложения за рецепти, внасяне): `POST` → `pending`, клиентът пита отново, докато заявката
 * не е `done`/`failed`; кодовете на `failed` са едни и същи. По `lib/ai-requests.ts` на family.
 */

/** Колко често се пита за заявка, която още е `pending`. */
export const POLL_INTERVAL_MS = 3000;

export const REQUEST_STATUS_LABELS: Record<ContractRequestStatus, string> = {
  pending: 'чака',
  done: 'готова',
  failed: 'неуспешна',
};

/** Какво е поискано от AI. */
export type AiRequestKind = 'suggest' | 'import';

/** Полетата на заявката, от които зависи съобщението; общи за всички AI заявки. */
export interface FailedAiRequest {
  error?: ContractFailure | undefined;
  createdAt?: string;
  finishedAt?: string | undefined;
}

/** Какво AI не е успяло да направи и какво може човекът оттук. */
const KINDS: Record<AiRequestKind, { failed: string; next: string }> = {
  suggest: {
    failed: 'AI не успя да предложи рецепти',
    next: 'Опитай пак или с друга подсказка.',
  },
  import: {
    failed: 'AI не успя да прочете рецептата',
    next: 'Опитай пак.',
  },
};

/** Кодовете, чийто текст казва сам и причината, и действието. */
const OWN_MESSAGES: Partial<
  Record<ContractFailure, Partial<Record<AiRequestKind, string>>>
> = {
  no_results: {
    suggest: 'Не намерих подходящи рецепти. Опитай пак или с друга подсказка.',
    import: 'Не намерих рецепта в източника.',
  },
  fetch_blocked: {
    import: 'Сайтът не позволява автоматично четене — постави текста.',
  },
  fetch_failed: { import: 'Страницата не се отвори — постави текста.' },
};

const MINUTE_MS = 60_000;

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
function reason(kind: AiRequestKind, request: FailedAiRequest): string {
  const { error, createdAt, finishedAt } = request;
  if (error === 'timeout') {
    return finishedAt === undefined || createdAt === undefined
      ? 'AI не отговори навреме'
      : `AI не отговори за ${waited(Date.parse(finishedAt) - Date.parse(createdAt))}`;
  }
  if (error === 'invalid_output') {
    return 'AI върна отговор, който не мога да прочета';
  }
  if (error?.startsWith('http_')) {
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
  request: FailedAiRequest,
): string {
  const own =
    request.error === undefined
      ? undefined
      : OWN_MESSAGES[request.error]?.[kind];
  return own ?? `${reason(kind, request)}. ${KINDS[kind].next}`;
}

const dateTimeFormat = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Кога е пусната заявката, по часа на браузъра. */
export function formatRequestTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
