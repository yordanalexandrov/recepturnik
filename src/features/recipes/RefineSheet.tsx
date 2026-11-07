import type { Recipe } from '@family/shared';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { ErrorBox } from '../../components/ErrorBox';
import { Sheet } from '../../components/Sheet';
import { Spinner } from '../../components/Spinner';
import { failureMessage } from '../ai/ai-requests';
import { componentHeading, formatMinutes } from './format';
import { ComparisonColumn, RecipeComparison } from './RecipeComparison';
import { useRefinement, useRequestRefinement } from './refinements';

interface RefineSheetProps {
  /** Записаната рецепта: нея подобрява AI и с нея се сравнява. */
  recipe: Recipe;
  /** Заявката, която листът чака: пусната при предишно отваряне и още неизчакана. Без нея листът пуска нова. */
  requestId: string | undefined;
  /** Листът пусна заявка (при отваряне или с „Опитай пак“). */
  onRequested: (requestId: string) => void;
  /** „Приеми“: подобрението на заявката `requestId` отива във формата за редакция. */
  onAccept: (requestId: string) => void;
  /** `pending`: заявката още чака, и отвореният пак лист продължава нея. */
  onClose: (pending: boolean) => void;
}

/** „1 снимка не се свали.“, „2 снимки не се свалиха.“ */
function droppedText(count: number): string {
  return count === 1
    ? '1 снимка не се свали.'
    : `${count} снимки не се свалиха.`;
}

/**
 * „Подобри рецептата“ (`recipe.refine`): пуска заявката при отваряне (или продължава чакащата), чака я и показва
 * предложението (стъпки, подготовка, време) до сегашната рецепта, и компонентите, които остават. „Приеми“ го води във
 * формата, „Откажи“ не променя нищо. Рецептата се променя едва при „Запази“ във формата. По `RefineSheet` на family.
 */
export function RefineSheet({
  recipe,
  requestId,
  onRequested,
  onAccept,
  onClose,
}: RefineSheetProps) {
  const start = useRequestRefinement();
  const request = useRefinement(requestId);

  const { mutate } = start;
  const ask = useCallback(() => {
    mutate(recipe.id, { onSuccess: (created) => onRequested(created.id) });
  }, [mutate, recipe.id, onRequested]);
  // Нова заявка тръгва веднъж, при отваряне без чакаща (и в StrictMode, който монтира два пъти); „Опитай пак“ пуска нова.
  const asked = useRef(requestId !== undefined);
  useEffect(() => {
    if (!asked.current) {
      asked.current = true;
      ask();
    }
  }, [ask]);

  const current = request.data;
  const close = () => onClose(current?.status === 'pending');
  const retry = (
    <button
      type="button"
      className="button"
      disabled={start.isPending}
      onClick={ask}
    >
      Опитай пак
    </button>
  );

  let body: ReactNode;
  if (start.isError) {
    body = <ErrorBox error={start.error} onRetry={ask} />;
  } else if (request.isError) {
    body = (
      <ErrorBox error={request.error} onRetry={() => void request.refetch()} />
    );
  } else if (!current || current.status === 'pending') {
    body = <Spinner label="Мисля…" />;
  } else if (current.status === 'failed') {
    const message = failureMessage('refine', current);
    body =
      current.error === 'no_results' ? (
        <p role="status">
          {current.noResults ? `${message} ${current.noResults}` : message}
        </p>
      ) : (
        <div className="error-box" role="alert">
          <p>{message}</p>
          {retry}
        </div>
      );
  } else if (current.refinement) {
    const { refinement } = current;
    // Подобрение отпреди подготовката е без нея и не я сменя: няма какво да се сравнява.
    const proposed = refinement.preparation;
    const comparesPreparation =
      proposed !== undefined &&
      (recipe.preparation.length > 0 || proposed.length > 0);
    body = (
      <>
        <p>{refinement.changes}</p>
        {refinement.source === 'unread' && (
          <p className="refine__note">
            Източникът не се отвори — без нови снимки.
          </p>
        )}
        {refinement.droppedPhotos > 0 && (
          <p className="refine__note">
            {droppedText(refinement.droppedPhotos)}
          </p>
        )}
        {refinement.prepMinutes !== undefined && (
          <p>Време: {formatMinutes(refinement.prepMinutes)}</p>
        )}
        {recipe.components.length > 0 && (
          <div>
            <p className="refine__note">
              Компонентите остават, с продуктите си:
            </p>
            <ul aria-label="Компонентите остават">
              {recipe.components.map((component, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: компонентите нямат id; индексът е техният.
                <li key={index}>{componentHeading(component)}</li>
              ))}
            </ul>
          </div>
        )}
        <RecipeComparison>
          <ComparisonColumn
            name="Сега"
            steps={recipe.steps}
            preparation={comparesPreparation ? recipe.preparation : undefined}
          />
          <ComparisonColumn
            name="Предложение"
            steps={refinement.steps}
            preparation={comparesPreparation ? proposed : undefined}
          />
        </RecipeComparison>
        <div className="refine__actions">
          <button
            type="button"
            className="button button--quiet"
            onClick={close}
          >
            Откажи
          </button>
          <button
            type="button"
            className="button"
            onClick={() => onAccept(current.id)}
          >
            Приеми
          </button>
        </div>
      </>
    );
  }

  return (
    <Sheet title="Подобри рецептата" onClose={close} closeLabel="Затвори" wide>
      <div className="refine">{body}</div>
    </Sheet>
  );
}
