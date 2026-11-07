import type { Recipe, RecipeInput } from '@family/shared';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import { useRecipe, useSaveRecipe } from './queries';
import { RecipeForm } from './RecipeForm';
import {
  type RecipeFormValues,
  recipeToFormValues,
} from './recipe-form-values';

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
}

export function parseEditRecipeSearch(
  search: Record<string, unknown>,
): EditRecipeSearch {
  return search.revise === true || search.revise === 'true'
    ? { revise: true }
    : {};
}

/**
 * „Редакция“ на `/recipes/$id/edit`: формата, попълнена с рецептата; записът я заменя (`PUT`) и води към прегледа.
 * `seed` дава началните стойности вместо рецептата както е (напр. с прието подобрение или поправка от AI, #11/#12).
 */
export function EditRecipeScreen({
  seed = recipeToFormValues,
}: {
  seed?: (recipe: Recipe) => RecipeFormValues;
}) {
  const { id } = useParams({ from: '/recipes/$id/edit' });
  const recipe = useRecipe(id);
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
      {recipe.isPending ? (
        <Spinner />
      ) : recipe.isError ? (
        <ErrorBox error={recipe.error} onRetry={() => void recipe.refetch()} />
      ) : (
        <RecipeForm
          // Формата чете началните стойности само веднъж: друга рецепта е нова форма.
          key={recipe.data.id}
          initialValues={seed(recipe.data)}
          onSubmit={submit}
          isSubmitting={save.isPending}
          submitError={save.error}
          onCancel={() => void navigate({ to: '/recipes/$id', params: { id } })}
        />
      )}
    </main>
  );
}
