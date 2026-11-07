import {
  type ContractFailure,
  type ContractRequestStatus,
  type SuggestionRequest,
  TAG_LABELS_BG,
} from '@family/shared';

export const REQUEST_STATUS_LABELS: Record<ContractRequestStatus, string> = {
  pending: 'чака',
  done: 'готова',
  failed: 'неуспешна',
};

/** Заявката накратко: „вечеря, обяд · нещо с пиле“. */
export function requestLabel({
  slots,
  hint,
}: Pick<SuggestionRequest, 'slots' | 'hint'>): string {
  const meals = slots.map((slot) => TAG_LABELS_BG[slot]).join(', ');
  return hint ? `${meals} · ${hint}` : meals;
}

const FAILED = 'AI не успя да предложи рецепти';
const NEXT = 'Опитай пак или с друга подсказка.';

/** Причината за `failed` заявка, преди действието: изречение без точка. */
function failureReason(error: ContractFailure | undefined): string {
  if (error === undefined) {
    return FAILED;
  }
  if (error === 'timeout') {
    return 'AI не отговори навреме';
  }
  if (error === 'invalid_output') {
    return 'AI върна отговор, който не мога да прочета';
  }
  if (error.startsWith('http_')) {
    return 'AI не е на разположение в момента';
  }
  if (error === 'stale') {
    return `${FAILED}: сървърът се рестартира междувременно`;
  }
  if (error === 'aborted') {
    return `${FAILED}: заявката беше прекъсната`;
  }
  return FAILED;
}

/**
 * Съобщение за неуспешна заявка за предложения: какво не е станало и какво може човекът, без кодове. По
 * `lib/ai-requests.ts` на family (само `suggest`).
 */
export function failureMessage(
  request: Pick<SuggestionRequest, 'error'>,
): string {
  if (request.error === 'no_results') {
    return `Не намерих подходящи рецепти. ${NEXT}`;
  }
  return `${failureReason(request.error)}. ${NEXT}`;
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
