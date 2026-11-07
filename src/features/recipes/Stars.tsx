import type { Rating } from '@family/shared';
import { useId } from 'react';

const STARS = [1, 2, 3, 4, 5] as const;
const MAX = STARS.length;

/** „4 от 5“ или „Неоценена“: как звучи оценката за екранен четец. */
export function ratingText(rating: Rating | null): string {
  return rating === null ? 'Неоценена' : `${rating} от ${MAX}`;
}

interface RatingStarsProps {
  rating: Rating | null;
  /** `null` маха оценката: втори натиск на същата звезда. */
  onRate: (rating: Rating | null) => void;
}

/** Група „Оценка“ с пет бутона „1 от 5“ … „5 от 5“; натискане на избрания маха оценката. */
export function RatingStars({ rating, onRate }: RatingStarsProps) {
  const descriptionId = useId();
  return (
    <fieldset
      aria-label="Оценка"
      aria-describedby={descriptionId}
      className="stars"
    >
      <span id={descriptionId} className="visually-hidden">
        {ratingText(rating)}
      </span>
      {STARS.map((star) => {
        const on = rating !== null && star <= rating;
        return (
          <button
            key={star}
            type="button"
            className={`stars__star${on ? ' stars__star--on' : ''}`}
            aria-label={`${star} от ${MAX}`}
            aria-pressed={star === rating}
            onClick={() => onRate(star === rating ? null : star)}
          >
            <span aria-hidden="true">{on ? '★' : '☆'}</span>
          </button>
        );
      })}
    </fieldset>
  );
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
