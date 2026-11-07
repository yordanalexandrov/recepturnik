import { type RecipeSuggestion, TAG_LABELS_BG } from '@family/shared';
import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import { ErrorBox } from '../../components/ErrorBox';
import { formatMinutes, formatQuantity } from '../recipes/format';
import { useRejectSuggestion, useRestoreSuggestion } from './queries';

/**
 * Едно предложение в резултатите на заявката: причината, времето и продуктите, и действията по статуса му. Отхвърленото
 * е отбелязано и има „Върни“, прието — води към рецептата.
 */
export function SuggestionCard({
  suggestion,
}: {
  suggestion: RecipeSuggestion;
}) {
  const titleId = useId();
  const productsId = useId();
  const { payload, status } = suggestion;
  return (
    <article
      className={`suggestion-card suggestion-card--${status}`}
      aria-labelledby={titleId}
    >
      <h2 id={titleId}>{payload.title}</h2>
      <p className="muted">
        {formatMinutes(payload.prepMinutes)}
        {payload.tags.length > 0 &&
          ` · ${payload.tags.map((tag) => TAG_LABELS_BG[tag]).join(' · ')}`}
      </p>
      <p>{payload.why}</p>
      <h3 id={productsId}>Продукти</h3>
      <ul className="suggestion-card__products" aria-labelledby={productsId}>
        {payload.ingredients.map((line) => {
          const quantity = formatQuantity(line);
          return (
            <li key={line.name}>
              {line.name}
              {quantity && ` ${quantity}`}
              {line.isNew && (
                <>
                  {' '}
                  <span className="badge">нов</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <SuggestionActions suggestion={suggestion} />
    </article>
  );
}

/**
 * Действията на картата по статуса на предложението: чакащото се приема, поправя („Поправи с AI“ отваря прегледа с
 * листа на поправката) или отхвърля.
 */
function SuggestionActions({ suggestion }: { suggestion: RecipeSuggestion }) {
  const reject = useRejectSuggestion();
  const restore = useRestoreSuggestion();
  const error = reject.error ?? restore.error;
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: група бутони, не полета на форма. */}
      <div
        className="suggestion-card__actions"
        role="group"
        aria-label="Действия с предложението"
      >
        {suggestion.status === 'proposed' && (
          <>
            <Link
              to="/recipes/suggest/$requestId/$suggestionId"
              params={{
                requestId: suggestion.requestId,
                suggestionId: suggestion.id,
              }}
              className="button"
            >
              Приеми
            </Link>
            <Link
              to="/recipes/suggest/$requestId/$suggestionId"
              params={{
                requestId: suggestion.requestId,
                suggestionId: suggestion.id,
              }}
              search={{ revise: true }}
              className="button button--quiet"
            >
              Поправи с AI
            </Link>
            <button
              type="button"
              className="button button--quiet"
              disabled={reject.isPending}
              onClick={() => {
                restore.reset();
                reject.mutate(suggestion.id);
              }}
            >
              Отхвърли
            </button>
          </>
        )}
        {suggestion.status === 'rejected' && (
          <>
            <span className="badge">Отхвърлено</span>
            <button
              type="button"
              className="button button--quiet"
              disabled={restore.isPending}
              onClick={() => {
                reject.reset();
                restore.mutate(suggestion.id);
              }}
            >
              Върни
            </button>
          </>
        )}
        {suggestion.status === 'approved' && (
          <>
            <span className="badge">Прието</span>
            {suggestion.recipeId && (
              <Link
                to="/recipes/$id"
                params={{ id: suggestion.recipeId }}
                className="button button--quiet"
              >
                Към рецептата
              </Link>
            )}
          </>
        )}
      </div>
      {error && <ErrorBox error={error} />}
    </>
  );
}
