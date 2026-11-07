import {
  type RecipeComponent,
  type RecipeLine,
  UNIT_LABELS_BG,
} from '@family/shared';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * Времето за един поглед: до час — „45 мин“, „60 мин“; над това — „3 ч 45 мин“, „17 ч“; от денонощие нагоре — „1 ден“,
 * „2 дни 3 ч“ (минутите там не се четат). Копие от family.
 */
export function formatMinutes(minutes: number): string {
  if (minutes <= MINUTES_PER_HOUR) {
    return `${minutes} мин`;
  }
  if (minutes >= MINUTES_PER_DAY) {
    const days = Math.floor(minutes / MINUTES_PER_DAY);
    const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
    const dayPart = days === 1 ? '1 ден' : `${days} дни`;
    return hours > 0 ? `${dayPart} ${hours} ч` : dayPart;
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

const numberFormat = new Intl.NumberFormat('bg-BG', {
  maximumFractionDigits: 3,
});

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** „500 г“, „2 бр.“, „по вкус“; без количество — нищо (само единицата не се показва). Копие от family. */
export function formatQuantity(
  line: Pick<RecipeLine, 'quantity' | 'unit'>,
): string {
  if (line.unit === 'pinch') {
    return UNIT_LABELS_BG.pinch;
  }
  if (line.quantity === null) {
    return '';
  }
  return `${formatNumber(line.quantity)} ${UNIT_LABELS_BG[line.unit]}`;
}

/** „1 порция“, „3 порции“, „0 порции“. */
export function formatServings(count: number): string {
  return count === 1 ? '1 порция' : `${count} порции`;
}

/** Заглавието на компонент в рецептата: „Песто · за 5 порции“. */
export function componentHeading(component: RecipeComponent): string {
  return `${component.name} · за ${formatServings(component.servings)}`;
}

/** Името на компонент във формата, докато се пише: празното е „Компонент без име“. Копие от family. */
export function componentName(name: string): string {
  return name.trim() || 'Компонент без име';
}

/** Домейнът на източника за показване: „https://www.example.com/x“ → „example.com“; невалиден адрес — както е. */
export function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Кратко име на уред: видът без модела и възможностите („air fryer (Philips …) — …“ → „air fryer“). */
export function applianceShortName(name: string): string {
  return name.split(/ \(| — /)[0]?.trim() || name;
}
