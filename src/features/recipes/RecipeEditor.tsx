import type { RecipeInput } from '@family/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { useSaveRecipe } from './queries';
import { RecipeForm } from './RecipeForm';
import type { RecipeFormValues } from './recipe-form-values';

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
