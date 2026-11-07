import { type SuggestionRequest, TAG_LABELS_BG } from '@family/shared';

/** Заявката накратко: „вечеря, обяд · нещо с пиле“. */
export function requestLabel({
  slots,
  hint,
}: Pick<SuggestionRequest, 'slots' | 'hint'>): string {
  const meals = slots.map((slot) => TAG_LABELS_BG[slot]).join(', ');
  return hint ? `${meals} · ${hint}` : meals;
}
