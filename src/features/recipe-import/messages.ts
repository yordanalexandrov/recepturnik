import { nonEmptyLines, type RecipeImportRequest } from '@family/shared';
import { failureMessage } from '../ai/ai-requests';
import { sourceDomain } from '../recipes/format';

// Надписите на внасянето, по `features/recipe-import/messages.ts` на family.

const SOURCE_LABELS: Record<RecipeImportRequest['source'], string> = {
  text: 'Текст',
  url: 'Линк',
  photo: 'Снимка',
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

/** Съобщението за неуспешно внасяне: при `no_results` причината на агента, иначе общото по кода. */
export function importFailureMessage(request: RecipeImportRequest): string {
  if (request.error === 'no_results' && request.noResults) {
    return `Не намерих рецепта: ${request.noResults}`;
  }
  return failureMessage('import', request);
}
