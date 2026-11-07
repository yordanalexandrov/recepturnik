import type { Recipe, RecipeInput } from '@family/shared';
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router';
import { useState } from 'react';
import { refusalOf } from '../../api/client';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import { useRecipe, useSaveRecipe } from './queries';
import { RecipeForm } from './RecipeForm';
import { ReviseSheet } from './ReviseSheet';
import {
  type RecipeFormValues,
  recipeToFormValues,
} from './recipe-form-values';
import { refinedFormValues, useRefinement } from './refinements';
import { revisedFormValues, useRefreshRevision } from './revisions';

/**
 * Запис (`POST` без `id`, `PUT` с `id`) и после към прегледа на рецептата; с `revisionId` — с приетата поправка, а ако
 * рецептата е записана след нея (`409 revision_stale`), нищо не се записва и `onStale` получава поправката.
 */
export function useSaveAndView(
  id?: string,
  revisionId?: string,
  onStale?: (revisionId: string) => void,
) {
  const save = useSaveRecipe();
  const navigate = useNavigate();
  return {
    save,
    submit(input: RecipeInput) {
      save.mutate(
        {
          ...(id ? { id } : {}),
          input: revisionId ? { ...input, revisionId } : input,
        },
        {
          onSuccess(recipe) {
            void navigate({ to: '/recipes/$id', params: { id: recipe.id } });
          },
          onError(error) {
            if (revisionId && onStale && refusalOf(error, 'revision_stale')) {
              // Листът казва защо; грешката под формата би го повторила.
              save.reset();
              onStale(revisionId);
            }
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
  /** „Поправи с AI“ и „Поправка чака преглед“: редакцията се отваря с листа на поправката. */
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

/** Формата с приетата поправка: новите начални стойности и `key`, за да ги прочете. */
interface RevisedForm {
  key: string;
  values: RecipeFormValues;
}

/**
 * „Редакция“ на `/recipes/$id/edit`: формата, попълнена с рецептата; записът я заменя (`PUT`) и води към прегледа.
 * С `?refine=<id>` формата започва с приетото подобрение на тази заявка (`refinedFormValues`); записът е обикновен
 * `PUT`, защото подобрението няма решение в api-то. С `?revise` се отваря листът „Поправи с AI“ (и бутонът над
 * стъпките го отваря): той продължава отворената поправка на рецептата, ако има такава. Приетата поправка влиза във
 * формата, а записът я маркира приета (`revisionId`); ако рецептата е записана след нея, листът се отваря пак с нея
 * остаряла. По `EditRecipeScreen` на family.
 */
export function EditRecipeScreen() {
  const { id } = useParams({ from: '/recipes/$id/edit' });
  const { refine, revise } = useSearch({ from: '/recipes/$id/edit' });
  const recipe = useRecipe(id);
  const refinement = useRefinement(refine);
  const refined =
    refinement.data?.status === 'done' ? refinement.data.refinement : undefined;
  const [revising, setRevising] = useState(revise === true);
  /**
   * Поправката, която листът пусна или към която води; `null` — решена тук. Без нея листът продължава отворената
   * поправка на рецептата, ако има такава, иначе иска указание.
   */
  const [revisionId, setRevisionId] = useState<string | null>();
  /** Полетата на формата при отваряне на листа: към тях се добавя приетата поправка. */
  const [snapshot, setSnapshot] = useState<RecipeFormValues>();
  const [revised, setRevised] = useState<RevisedForm>();
  /** Приетата поправка във формата: записът я маркира приета. */
  const [acceptedRevision, setAcceptedRevision] = useState<string>();
  const refreshRevision = useRefreshRevision();
  // Приета остава, докато листът не я отхвърли или пусне наново, така че нов запис пак не затрива по-новия.
  const { save, submit } = useSaveAndView(id, acceptedRevision, (stale) => {
    refreshRevision(stale);
    setRevisionId(stale);
    setRevising(true);
  });
  const navigate = useNavigate();
  const initialValues = (current: Recipe) =>
    refined ? refinedFormValues(current, refined) : recipeToFormValues(current);
  return (
    <main className="screen">
      <header className="screen__header">
        <h1>Редакция</h1>
        <Link to="/recipes/$id" params={{ id }}>
          ← Към рецептата
        </Link>
      </header>
      {revised ? (
        <p className="edit-recipe__note" role="status">
          Поправката е във формата. Прегледай я и запиши.
        </p>
      ) : (
        refined && (
          <p className="edit-recipe__note" role="status">
            Подобрението е във формата. Прегледай го и запиши.
          </p>
        )
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
          // Формата чете началните стойности само веднъж: друга рецепта, подобрение или поправка е нова форма.
          key={`${recipe.data.id}:${refined ? refine : ''}:${revised?.key ?? ''}`}
          initialValues={revised?.values ?? initialValues(recipe.data)}
          onSubmit={submit}
          isSubmitting={save.isPending}
          submitError={save.error}
          onCancel={() => void navigate({ to: '/recipes/$id', params: { id } })}
          aiActions={(values) => (
            <button
              type="button"
              className="button button--quiet"
              onClick={() => {
                setSnapshot(values);
                setRevising(true);
              }}
            >
              Поправи с AI
            </button>
          )}
        />
      )}
      {revising && recipe.data && (
        <ReviseSheet
          recipe={recipe.data}
          target={{ recipeId: id }}
          requestId={
            revisionId === undefined
              ? (recipe.data.openRevision?.id ?? undefined)
              : (revisionId ?? undefined)
          }
          onRequested={(requested) => {
            setAcceptedRevision(undefined);
            setRevisionId(requested);
          }}
          onAccept={(accepted, revision) => {
            const base =
              snapshot ?? revised?.values ?? initialValues(recipe.data);
            setRevised({
              key: accepted,
              values: revisedFormValues(base, revision),
            });
            setAcceptedRevision(accepted);
            setRevisionId(null);
            setRevising(false);
          }}
          onRejected={() => {
            setAcceptedRevision(undefined);
            setRevisionId(null);
            setRevising(false);
          }}
          onClose={() => setRevising(false)}
        />
      )}
    </main>
  );
}
