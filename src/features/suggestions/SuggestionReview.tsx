import {
  type Ingredient,
  normalizeIngredientName,
  type RecipeSuggestion,
} from '@family/shared';
import { useQueries } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import { ingredientSearchQuery } from '../recipes/queries';
import { RecipeForm } from '../recipes/RecipeForm';
import {
  useApproveSuggestion,
  useRestoreSuggestion,
  useSuggestionRequest,
} from './queries';
import { suggestionToFormValues } from './suggestion-form-values';

const ROUTE = '/recipes/suggest/$requestId/$suggestionId';

/** `/recipes/suggest/:requestId/:suggestionId`: прегледът на едно предложение във формата и приемането му. */
export function SuggestionReview() {
  const { requestId, suggestionId } = useParams({ from: ROUTE });
  const detail = useSuggestionRequest(requestId);
  const suggestion = detail.data?.suggestions.find(
    (s) => s.id === suggestionId,
  );
  return (
    <main className="screen">
      <header className="screen__header">
        <h1>{suggestion ? suggestion.payload.title : 'Предложение'}</h1>
        <Link to="/recipes/suggest/$requestId" params={{ requestId }}>
          ← Предложения
        </Link>
      </header>
      {detail.isPending ? (
        <Spinner />
      ) : detail.isError ? (
        <ErrorBox error={detail.error} onRetry={() => void detail.refetch()} />
      ) : !suggestion ? (
        <p className="muted">Няма такова предложение.</p>
      ) : suggestion.status !== 'proposed' ? (
        <Decided suggestion={suggestion} />
      ) : (
        <ReviewSuggestion key={suggestion.id} suggestion={suggestion} />
      )}
    </main>
  );
}

/** Решено предложение: какво е решено и връзка към рецептата; отхвърленото има „Върни“ и прегледът се връща. */
function Decided({ suggestion }: { suggestion: RecipeSuggestion }) {
  const restore = useRestoreSuggestion();
  return (
    <div>
      <p>
        {suggestion.status === 'approved'
          ? 'Предложението е прието.'
          : 'Предложението е отхвърлено.'}
      </p>
      {suggestion.recipeId && (
        <Link
          to="/recipes/$id"
          params={{ id: suggestion.recipeId }}
          className="button"
        >
          Към рецептата
        </Link>
      )}
      {suggestion.status === 'rejected' && (
        <button
          type="button"
          className="button"
          disabled={restore.isPending}
          onClick={() => restore.mutate(suggestion.id)}
        >
          Върни
        </button>
      )}
      {restore.isError && <ErrorBox error={restore.error} />}
    </div>
  );
}

/**
 * Продуктите на предложението, които агентът смята за познати, по име от регистъра (точно съвпадение на каноничното
 * име). Търсенето връща точното съвпадение първо, така че лимитът на резултатите не го изрязва.
 */
function useResolvedIngredients(suggestion: RecipeSuggestion) {
  const names = [
    ...new Set(
      suggestion.payload.ingredients
        .filter((line) => !line.isNew)
        .map((line) => line.name),
    ),
  ];
  return useQueries({
    queries: names.map((name) => ingredientSearchQuery(name)),
    combine(results) {
      const resolved = new Map<string, Ingredient>();
      names.forEach((name, index) => {
        const canonical = normalizeIngredientName(name);
        const match = results[index]?.data?.find((i) => i.name === canonical);
        if (match) {
          resolved.set(name, match);
        }
      });
      // Неуспешно търсене не спира прегледа: редът просто остава за свързване.
      return { isPending: results.some((r) => r.isPending), resolved };
    },
  });
}

/**
 * Предложението във формата на рецепта: „Запази“ го приема (`approve`) и отива на новата рецепта. Несвързан продукт
 * (нов или непознат) спира записа и отваря листа си, както в „Нова рецепта“.
 */
function ReviewSuggestion({ suggestion }: { suggestion: RecipeSuggestion }) {
  const { isPending, resolved } = useResolvedIngredients(suggestion);
  const approve = useApproveSuggestion();
  const navigate = useNavigate();
  const { why, sourceUrl } = suggestion.payload;
  return (
    <>
      <section className="suggestion-review__note">
        <p>
          <strong>Защо:</strong> {why}
        </p>
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
          Отвори източника
        </a>
      </section>
      {isPending ? (
        <Spinner />
      ) : (
        <RecipeForm
          initialValues={suggestionToFormValues(suggestion.payload, resolved)}
          isSubmitting={approve.isPending}
          submitError={approve.error}
          onSubmit={(input) =>
            approve.mutate(
              // „Без уред“ е `null`: без поле api-то би взело уреда на предложението.
              {
                id: suggestion.id,
                input: { ...input, appliance: input.appliance ?? null },
              },
              {
                onSuccess({ recipe }) {
                  void navigate({
                    to: '/recipes/$id',
                    params: { id: recipe.id },
                  });
                },
              },
            )
          }
          onCancel={() =>
            void navigate({
              to: '/recipes/suggest/$requestId',
              params: { requestId: suggestion.requestId },
            })
          }
        />
      )}
    </>
  );
}
