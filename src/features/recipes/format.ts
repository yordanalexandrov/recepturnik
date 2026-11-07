export const MINUTES_PER_HOUR = 60;
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
