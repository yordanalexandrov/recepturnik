import {
  type ContractRequestStatus,
  nonEmptyLines,
  type RecipeImportRequest,
} from '@family/shared';
import { sourceDomain } from '../recipes/format';

// Надписите на внасянето, по `features/recipe-import/messages.ts` и `lib/ai-requests.ts` на family (само частта за
// внасяне).

const SOURCE_LABELS: Record<RecipeImportRequest['source'], string> = {
  text: 'Текст',
  url: 'Линк',
  photo: 'Снимка',
};

export const IMPORT_STATUS_LABELS: Record<ContractRequestStatus, string> = {
  pending: 'чака',
  done: 'готова',
  failed: 'неуспешна',
};

/** Текстът, отрязан до `max` знака по цяла дума, с „…“, ако е отрязан. */
export function shorten(text: string, max = 40): string {
  const chars = [...text];
  if (chars.length <= max) {
    return text;
  }
  const head = chars.slice(0, max).join('');
  const atWord =
    chars[max] === ' '
      ? head
      : head.slice(0, Math.max(head.lastIndexOf(' '), 0));
  return `${(atWord || head).trimEnd()}…`;
}

const dateFormat = new Intl.DateTimeFormat('bg-BG', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatDateTime(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/**
 * Как се казва внасянето в списъка: заглавието на предложението, а докато го няма — първият ред на текста (до ~40
 * знака) или домейнът на линка; само при снимка видът на източника.
 */
export function importLabel(request: RecipeImportRequest): string {
  if (request.title) {
    return request.title;
  }
  if (request.firstLine) {
    return shorten(request.firstLine);
  }
  if (request.source === 'url' && request.url) {
    return sourceDomain(request.url);
  }
  return SOURCE_LABELS[request.source];
}

/** Първите 2 непразни реда на поставения текст, всеки отрязан до ~60 знака. */
export function textLead(text: string): string {
  return nonEmptyLines(text)
    .slice(0, 2)
    .map((line) => shorten(line, 60))
    .join('\n');
}

const FAILED = 'AI не успя да прочете рецептата';
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

/**
 * Съобщението за неуспешно внасяне, без кодове: при `no_results` причината на агента; страница, която не се чете —
 * „постави текста“; иначе причината и „Опитай пак.“.
 */
export function importFailureMessage(request: RecipeImportRequest): string {
  const { error } = request;
  if (error === 'no_results') {
    return request.noResults
      ? `Не намерих рецепта: ${request.noResults}`
      : 'Не намерих рецепта в източника.';
  }
  if (error === 'fetch_blocked') {
    return 'Сайтът не позволява автоматично четене — постави текста.';
  }
  if (error === 'fetch_failed') {
    return 'Страницата не се отвори — постави текста.';
  }
  return `${failureReason(request)}. Опитай пак.`;
}

function failureReason({
  error,
  createdAt,
  finishedAt,
}: RecipeImportRequest): string {
  if (error === 'timeout') {
    return finishedAt === undefined
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
    return `${FAILED}: сървърът се рестартира междувременно`;
  }
  if (error === 'aborted') {
    return `${FAILED}: заявката беше прекъсната`;
  }
  return FAILED;
}
