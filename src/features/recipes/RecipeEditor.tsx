import type { Recipe, RecipeInput } from '@family/shared';
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import { useRecipe, useSaveRecipe } from './queries';
import { RecipeForm } from './RecipeForm';
import {
  type RecipeFormValues,
  recipeToFormValues,
} from './recipe-form-values';
import { refinedFormValues, useRefinement } from './refinements';

/** Запис (`POST` без `id`, `PUT` с `id`) и после към прегледа на рецептата. */
export function useSaveAndView(id?: string) {
  const save = useSaveRecipe();
  const navigate = useNavigate();
  return {
    save,
    submit(input: RecipeInput) {
      save.mutate(
        { ...(id ? { id } : {}), input },
        {
          onSuccess(recipe) {
            void navigate({ to: '/recipes/$id', params: { id: recipe.id } });
          },
        },
      );
    },
  };
}

/** „Нова рецепта“ на `/recipes/new`; с `initialValues` — от чернова (внасяне, предложение). */
export function NewRecipeScreen({
  initialValues,
}: {
  initialValues?: RecipeFormValues;
}) {
  const { save, submit } = useSaveAndView();
  const navigate = useNavigate();
  return (
    <main className="screen">
      <header className="screen__header">
        <h1>Нова рецепта</h1>
        <Link to="/recipes">← Рецепти</Link>
      </header>
      <RecipeForm
        {...(initialValues ? { initialValues } : {})}
        onSubmit={submit}
        isSubmitting={save.isPending}
        submitError={save.error}
        onCancel={() => void navigate({ to: '/recipes' })}
      />
    </main>
  );
}

export interface EditRecipeSearch {
  /** „Поправи с AI“ (#12): редакцията се отваря с листа на поправката. Засега само минава през адреса. */
  revise?: true;
  /** Приетото подобрение („Подобри рецептата“): id-то на заявката, чието подобрение формата започва с. */
  refine?: string;
}

export function parseEditRecipeSearch(
  search: Record<string, unknown>,
): EditRecipeSearch {
  return {
    ...(search.revise === true || search.revise === 'true'
      ? { revise: true as const }
      : {}),
    ...(typeof search.refine === 'string' && search.refine !== ''
      ? { refine: search.refine }
      : {}),
  };
}

/**
 * „Редакция“ на `/recipes/$id/edit`: формата, попълнена с рецептата; записът я заменя (`PUT`) и води към прегледа.
 * `seed` дава началните стойности вместо рецептата както е (напр. с приета поправка от AI, #12). С `?refine=<id>`
 * формата започва с приетото подобрение на тази заявка (`refinedFormValues`); записът е обикновен `PUT`, защото
 * подобрението няма решение в api-то.
 */
export function EditRecipeScreen({
  seed = recipeToFormValues,
}: {
  seed?: (recipe: Recipe) => RecipeFormValues;
}) {
  const { id } = useParams({ from: '/recipes/$id/edit' });
  const { refine } = useSearch({ from: '/recipes/$id/edit' });
  const recipe = useRecipe(id);
  const refinement = useRefinement(refine);
  const accepted =
    refinement.data?.status === 'done' ? refinement.data.refinement : undefined;
  const { save, submit } = useSaveAndView(id);
  const navigate = useNavigate();
  return (
    <main className="screen">
      <header className="screen__header">
        <h1>Редакция</h1>
        <Link to="/recipes/$id" params={{ id }}>
          ← Към рецептата
        </Link>
      </header>
      {accepted && (
        <p className="edit-recipe__note" role="status">
          Подобрението е във формата. Прегледай го и запиши.
        </p>
      )}
      {recipe.isPending || (refine !== undefined && refinement.isPending) ? (
        <Spinner />
      ) : recipe.isError ? (
        <ErrorBox error={recipe.error} onRetry={() => void recipe.refetch()} />
      ) : refinement.isError ? (
        <ErrorBox
          error={refinement.error}
          onRetry={() => void refinement.refetch()}
        />
      ) : (
        <RecipeForm
          // Формата чете началните стойности само веднъж: друга рецепта (или друго подобрение) е нова форма.
          key={`${recipe.data.id}:${accepted ? refine : ''}`}
          initialValues={
            accepted
              ? refinedFormValues(recipe.data, accepted)
              : seed(recipe.data)
          }
          onSubmit={submit}
          isSubmitting={save.isPending}
          submitError={save.error}
          onCancel={() => void navigate({ to: '/recipes/$id', params: { id } })}
        />
      )}
    </main>
  );
}
