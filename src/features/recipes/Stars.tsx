import type { Rating } from '@family/shared';

const STARS = [1, 2, 3, 4, 5] as const;
const MAX = STARS.length;

/** „4 от 5“ или „Неоценена“: как звучи оценката за екранен четец. */
export function ratingText(rating: Rating | null): string {
  return rating === null ? 'Неоценена' : `${rating} от ${MAX}`;
}

/** Оценката само за четене (в картата на регистъра); неоценена рецепта не показва нищо. */
export function StarsBadge({ rating }: { rating: Rating | null }) {
  if (rating === null) {
    return null;
  }
  return (
    <span
      className="stars-badge"
      role="img"
      aria-label={`Оценка ${ratingText(rating)}`}
    >
      {STARS.map((star) => (star <= rating ? '★' : '☆')).join('')}
    </span>
  );
}
