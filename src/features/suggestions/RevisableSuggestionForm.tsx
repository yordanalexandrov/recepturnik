import type { RecipeInput } from '@family/shared';
import { useState } from 'react';
import {
  type AiReplacement,
  RecipeForm,
  type RecipeFormProps,
} from '../recipes/RecipeForm';
import { ReviseSheet } from '../recipes/ReviseSheet';
import {
  type RecipeFormValues,
  toRevisableRecipe,
} from '../recipes/recipe-form-values';
import {
  type RevisionBase,
  type RevisionTarget,
  revisedFormValues,
  revisionBaseOf,
} from '../recipes/revisions';

/** Рецептата от формата, която листът поправя и с която сравнява; взета при отваряне без поправка. */
interface Snapshot {
  base: RevisionBase;
  target: RevisionTarget;
}

function snapshotOf(
  suggestionId: string,
  values: RecipeFormValues,
): Snapshot | undefined {
  const revisable = toRevisableRecipe(values);
  return revisable
    ? {
        base: revisionBaseOf(revisable.recipe, revisable.linked),
        target: { suggestionId, recipe: revisable.recipe },
      }
    : undefined;
}

interface RevisableSuggestionFormProps
  extends Omit<RecipeFormProps, 'initialValues' | 'onSubmit' | 'aiActions'> {
  suggestionId: string;
  initialValues: RecipeFormValues;
  /** Листът „Поправи с AI“ е отворен още при показване (`?revise`). */
  revise?: boolean;
  /** Одобрението; `revisionId` — приетата поправка във формата, за да я маркира приета. */
  onSubmit: (input: RecipeInput, revisionId: string | undefined) => void;
}

/**
 * Формата за преглед на предложение (или чернова от внасяне) с „Поправи с AI“: поправката е върху рецептата от формата,
 * както е (незаписана), „Приеми“ я слага във формата, а одобрението я маркира приета. По `SuggestionReview` на family.
 */
export function RevisableSuggestionForm({
  suggestionId,
  initialValues,
  revise = false,
  onSubmit,
  ...formProps
}: RevisableSuggestionFormProps) {
  /** Приетата поправка, приложена върху полетата на формата, както са сега. */
  const [replacement, setReplacement] = useState<AiReplacement>();
  const [snapshot, setSnapshot] = useState(() =>
    revise ? snapshotOf(suggestionId, initialValues) : undefined,
  );
  const [revising, setRevising] = useState(snapshot !== undefined);
  /** Поправката, която още чака или не е решена: отвореният пак лист продължава нея, със същата рецепта. */
  const [revisionId, setRevisionId] = useState<string>();
  const [acceptedRevision, setAcceptedRevision] = useState<string>();
  return (
    <>
      <RecipeForm
        {...formProps}
        initialValues={initialValues}
        aiReplacement={replacement}
        onSubmit={(input) => onSubmit(input, acceptedRevision)}
        aiActions={(current) => {
          const disabled =
            revisionId === undefined &&
            toRevisableRecipe(current) === undefined;
          return (
            <button
              type="button"
              className="button button--quiet"
              disabled={disabled}
              title={
                disabled ? 'Нужни са порции и поне една стъпка' : undefined
              }
              onClick={() => {
                if (revisionId === undefined) {
                  setSnapshot(snapshotOf(suggestionId, current));
                }
                setRevising(true);
              }}
            >
              Поправи с AI
            </button>
          );
        }}
      />
      {revising && snapshot && (
        <ReviseSheet
          recipe={snapshot.base}
          target={snapshot.target}
          requestId={revisionId}
          onRequested={setRevisionId}
          onAccept={(accepted, revision) => {
            setReplacement((current) => ({
              key: (current?.key ?? 0) + 1,
              apply: (values) => revisedFormValues(values, revision),
            }));
            setAcceptedRevision(accepted);
            setRevisionId(undefined);
            setRevising(false);
          }}
          onRejected={() => {
            setRevisionId(undefined);
            setRevising(false);
          }}
          onClose={() => setRevising(false)}
        />
      )}
    </>
  );
}
