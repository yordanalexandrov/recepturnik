import {
  linesByComponent,
  RECIPE_REVISION_INSTRUCTION_MAX,
  type RecipeRevision,
} from '@family/shared';
import { type FormEvent, type ReactNode, useState } from 'react';
import { refusalOf } from '../../api/client';
import { ErrorBox } from '../../components/ErrorBox';
import { Field } from '../../components/Field';
import { Sheet } from '../../components/Sheet';
import { Spinner } from '../../components/Spinner';
import { failureMessage } from '../ai/ai-requests';
import { componentHeading, formatMinutes, formatQuantity } from './format';
import { ComparisonColumn, RecipeComparison } from './RecipeComparison';
import {
  type ComparedLine,
  type RevisionBase,
  type RevisionTarget,
  useRejectRevision,
  useRequestRevision,
  useRevision,
} from './revisions';

/** От толкова знака нагоре под полето личи колко остават. */
const COUNT_FROM = RECIPE_REVISION_INSTRUCTION_MAX - 50;

interface ReviseSheetProps {
  /** Рецептата, която AI поправя и с която се сравнява: записаната, или формата за преглед на предложение. */
  recipe: RevisionBase;
  /** Къде се пуска поправката: на рецептата или на предложението, с рецептата от формата. */
  target: RevisionTarget;
  /** Поправката, която листът чака: пусната при предишно отваряне и още нерешена. Без нея листът иска указание. */
  requestId: string | undefined;
  /** Листът пусна поправка („Изпрати“, „Опитай пак“, „Пусни пак“) или води към отворената. */
  onRequested: (requestId: string) => void;
  /** „Приеми“: поправката отива във формата като незаписана промяна. */
  onAccept: (requestId: string, revision: RecipeRevision) => void;
  /** „Отхвърли“: поправката е отхвърлена и листът се затваря. */
  onRejected: () => void;
  /** `pending`: поправката още чака, и отвореният пак лист продължава нея. */
  onClose: (pending: boolean) => void;
}

/** „4 порции“, „1 порция“, с времето, ако го има: „4 порции · 45 мин“. */
function servingsText(servings: number, prepMinutes: number | undefined) {
  const portions = servings === 1 ? '1 порция' : `${servings} порции`;
  return prepMinutes === undefined
    ? portions
    : `${portions} · ${formatMinutes(prepMinutes)}`;
}

/** „черен пипер · по вкус (нов продукт)“, „червен пипер · 1 ч.л. (сладък)“. */
function lineText(line: ComparedLine): string {
  const name = line.ingredient?.name ?? line.newProduct?.name ?? '';
  const amount = formatQuantity(line);
  return [
    amount === '' ? name : `${name} · ${amount}`,
    line.note ? ` (${line.note})` : '',
    line.ingredient ? '' : ' (нов продукт)',
  ].join('');
}

/** „1 снимка отпада.“, „2 снимки отпадат.“ */
function droppedText(count: number): string {
  return count === 1 ? '1 снимка отпада.' : `${count} снимки отпадат.`;
}

function Lines({
  label,
  lines,
}: {
  label: string;
  lines: readonly ComparedLine[];
}) {
  return (
    <ul className="refine__lines" aria-label={label}>
      {lines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: редовете нямат id; редът е идентичността им.
        <li key={index}>{lineText(line)}</li>
      ))}
    </ul>
  );
}

/**
 * Едната колона: порциите и времето, продуктите на ястието, всеки компонент под заглавието си („Песто · за 5 порции“)
 * с неговите продукти, подготовката (ако `withPreparation`) и стъпките.
 */
function RevisionColumn({
  name,
  recipe,
  withPreparation,
}: {
  name: string;
  recipe: RevisionBase;
  withPreparation: boolean;
}) {
  const lower = name.toLocaleLowerCase('bg');
  const lines = linesByComponent(
    recipe.ingredients,
    recipe.components.length,
    (line) => line.component,
  );
  return (
    <ComparisonColumn
      name={name}
      steps={recipe.steps}
      preparation={withPreparation ? recipe.preparation : undefined}
      stepsLabel={`Стъпки: ${lower}`}
    >
      <p className="refine__note">
        {servingsText(recipe.servings, recipe.prepMinutes)}
      </p>
      <Lines label={`Продукти: ${lower}`} lines={lines.main} />
      {recipe.components.map((component, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: компонентите нямат id; индексът е техният.
        <section key={index}>
          <h4 className="comparison__subheading">
            {componentHeading(component)}
          </h4>
          <Lines
            label={`${component.name}: ${lower}`}
            lines={lines.components[index] ?? []}
          />
        </section>
      ))}
    </ComparisonColumn>
  );
}

/**
 * „Поправи с AI“ (GLOSSARY на family: Поправка на рецепта): указание до 500 знака и „Изпрати“, после „Мисля…“, докато
 * AI работи (листът може да се затвори и отвори пак), и сравнението „Сега“ / „С поправката“ с какво е сменено и „Ти
 * написа: …“. „Приеми“ слага поправката във формата, „Отхвърли“ я отхвърля. Неуспехът има „Опитай пак“ със същото
 * указание; „няма какво да се поправи“ казва причината и пита за ново указание. Рецепта с поправка, която чака преглед
 * (`409 revision_open`), не пуска втора: листът води към чакащата. Записана след поправката рецепта (`stale`) няма
 * „Приеми“, а „Пусни пак“ отхвърля старата и пуска същото указание. По `ReviseSheet` на family.
 */
export function ReviseSheet({
  recipe,
  target,
  requestId,
  onRequested,
  onAccept,
  onRejected,
  onClose,
}: ReviseSheetProps) {
  const start = useRequestRevision();
  const request = useRevision(requestId);
  const reject = useRejectRevision();
  const [text, setText] = useState('');

  const send = (instruction: string, applied?: readonly string[]) =>
    start.mutate(
      { target, instruction, ...(applied ? { applied } : {}) },
      { onSuccess: (created) => onRequested(created.id) },
    );
  const current = request.data;
  const close = () => onClose(current?.status === 'pending');
  const trimmed = text.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed === '' || start.isPending) {
      return;
    }
    send(trimmed);
  };

  const form = (
    <form className="refine__form" onSubmit={submit}>
      <Field label="Какво да се промени?">
        {(props) => (
          <textarea
            {...props}
            className="input"
            rows={3}
            maxLength={RECIPE_REVISION_INSTRUCTION_MAX}
            placeholder="напр. картофите искат още 20 минути"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        )}
      </Field>
      {text.length >= COUNT_FROM && (
        <p className="refine__note">
          {text.length}/{RECIPE_REVISION_INSTRUCTION_MAX}
        </p>
      )}
      <div className="refine__actions">
        <button
          type="submit"
          className="button"
          disabled={trimmed === '' || start.isPending}
        >
          Изпрати
        </button>
      </div>
    </form>
  );
  const retry = (instruction: string, applied?: readonly string[]) => (
    <button
      type="button"
      className="button"
      disabled={start.isPending}
      onClick={() => send(instruction, applied)}
    >
      Опитай пак
    </button>
  );

  // Рецептата вече има поправка, която чака преглед: листът води към нея.
  const openRevision = refusalOf(start.error, 'revision_open');

  let body: ReactNode;
  if (openRevision) {
    body = (
      <>
        <p role="status">Поправка чака преглед</p>
        <div className="refine__actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              start.reset();
              onRequested(openRevision.revisionId);
            }}
          >
            Отвори поправката
          </button>
        </div>
      </>
    );
  } else if (start.isError) {
    body = (
      <>
        <ErrorBox error={start.error} />
        {start.variables &&
          retry(start.variables.instruction, start.variables.applied)}
      </>
    );
  } else if (start.isPending) {
    body = <Spinner label="Мисля…" />;
  } else if (requestId === undefined) {
    body = form;
  } else if (request.isError) {
    body = (
      <ErrorBox error={request.error} onRetry={() => void request.refetch()} />
    );
  } else if (!current || current.status === 'pending') {
    body = (
      <>
        {current && <Instruction text={current.instruction} />}
        <Spinner label="Мисля…" />
      </>
    );
  } else if (current.status === 'failed') {
    const message = failureMessage('revise', current);
    body =
      current.error === 'no_results' ? (
        <>
          <Instruction text={current.instruction} />
          <p role="status">
            {current.noResults ? `${message} ${current.noResults}` : message}
          </p>
          {form}
        </>
      ) : (
        <>
          <Instruction text={current.instruction} />
          <div className="error-box" role="alert">
            <p>{message}</p>
          </div>
          {retry(current.instruction, current.applied)}
        </>
      );
  } else if (current.revision) {
    const revision = current.revision;
    const comparesPreparation =
      recipe.preparation.length > 0 || revision.preparation.length > 0;
    body = (
      <>
        <p>{revision.changes}</p>
        <Instruction text={current.instruction} />
        {revision.droppedPhotos > 0 && (
          <p className="refine__note">{droppedText(revision.droppedPhotos)}</p>
        )}
        <RecipeComparison>
          <RevisionColumn
            name="Сега"
            recipe={recipe}
            withPreparation={comparesPreparation}
          />
          <RevisionColumn
            name="С поправката"
            recipe={revision}
            withPreparation={comparesPreparation}
          />
        </RecipeComparison>
        {current.stale && (
          <p role="status">
            Рецептата е записана след поправката: тя вече не може да се приеме.
          </p>
        )}
        {reject.isError && <ErrorBox error={reject.error} />}
        <div className="refine__actions">
          <button
            type="button"
            className="button button--quiet"
            disabled={reject.isPending}
            onClick={() =>
              reject.mutate(current.id, { onSuccess: () => onRejected() })
            }
          >
            Отхвърли
          </button>
          {current.stale ? (
            // Приемането би изтрило по-новия запис: старата се отхвърля и същото указание се пуска върху него.
            <button
              type="button"
              className="button"
              disabled={reject.isPending || start.isPending}
              onClick={() =>
                reject.mutate(current.id, {
                  onSuccess: () => send(current.instruction, current.applied),
                })
              }
            >
              Пусни пак
            </button>
          ) : (
            <button
              type="button"
              className="button"
              onClick={() => onAccept(current.id, revision)}
            >
              Приеми
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <Sheet
      title="Поправи с AI"
      onClose={close}
      closeLabel="Затвори"
      focusField={requestId === undefined}
      wide
    >
      <div className="refine">{body}</div>
    </Sheet>
  );
}

function Instruction({ text }: { text: string }) {
  return <p className="refine__note">Ти написа: {text}</p>;
}
