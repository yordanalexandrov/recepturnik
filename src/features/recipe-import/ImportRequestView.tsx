import type {
  ImportedSuggestion,
  Ingredient,
  RecipeImportDetail,
  RecipeImportParams,
} from '@family/shared';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import { sourceDomain } from '../recipes/format';
import {
  useApproveSuggestion,
  useRejectSuggestion,
  useRestoreSuggestion,
} from '../suggestions/queries';
import { RevisableSuggestionForm } from '../suggestions/RevisableSuggestionForm';
import { importToFormValues } from './import-form-values';
import { importFailureMessage, textLead } from './messages';
import { useImport, useRequestImport, useSentPhoto } from './queries';

/**
 * `/recipes/import/:requestId`: изчакване, докато внасянето е `pending` (проверява се периодично), после черновата във
 * формата за нова рецепта, решението по нея или грешката.
 */
export function ImportRequestView() {
  const { requestId } = useParams({ from: '/recipes/import/$requestId' });
  const detail = useImport(requestId);
  const draft =
    detail.data?.request.status === 'done' &&
    detail.data.suggestion?.status === 'proposed';
  return (
    <main className="screen">
      <header className="screen__header">
        <h1>{draft ? 'Нова рецепта' : 'Внасяне'}</h1>
        <Link to="/recipes/import">← Внеси рецепта</Link>
      </header>
      {detail.isPending ? (
        <Spinner />
      ) : detail.isError ? (
        <ErrorBox error={detail.error} onRetry={() => void detail.refetch()} />
      ) : (
        <ImportResult detail={detail.data} />
      )}
    </main>
  );
}

function ImportResult({ detail }: { detail: RecipeImportDetail }) {
  const { request, suggestion } = detail;
  if (request.status === 'pending') {
    return (
      <div className="import-waiting">
        <Spinner label="Изчакване…" />
        <p>Чета рецептата… обикновено отнема до минута</p>
        <ImportSubject detail={detail} />
      </div>
    );
  }
  if (request.status === 'failed' || !suggestion) {
    return <ImportFailed detail={detail} />;
  }
  if (suggestion.status !== 'proposed') {
    return <Decided suggestion={suggestion} />;
  }
  return (
    <ImportDraft
      suggestion={suggestion}
      linked={detail.ingredients}
      sourceUrl={request.url}
    />
  );
}

/** Адрес за `<img>` на blob, освободен при смяна или напускане. */
function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const created = URL.createObjectURL(blob);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [blob]);
  return url;
}

/**
 * Какво се внася, под изчакването и грешката: първите 2 реда на текста, домейнът на линка или миниатюрата на снимката
 * (ако още е в паметта; иначе само „Снимка“).
 */
function ImportSubject({ detail }: { detail: RecipeImportDetail }) {
  const { request, text } = detail;
  const sent = useSentPhoto(request.id);
  const photoUrl = useObjectUrl(request.source === 'photo' ? sent : undefined);
  if (request.source === 'photo') {
    return (
      <p className="import-subject">
        Снимка
        {photoUrl && (
          <img
            className="import-subject__photo"
            src={photoUrl}
            alt="Внасяната снимка"
          />
        )}
      </p>
    );
  }
  const subject =
    text !== undefined
      ? `Текст: ${textLead(text)}`
      : request.url
        ? `Линк: ${sourceDomain(request.url)}`
        : undefined;
  return subject ? <p className="import-subject">{subject}</p> : null;
}

/**
 * Черновата от внасянето във формата за нова рецепта: допусканията на AI отгоре, редовете с продукти от регистъра —
 * свързани, новите — за свързване или „Нов продукт“. „Запази“ одобрява предложението с рецептата от формата и отваря
 * рецептата; „Отхвърли“ го отхвърля, а „Поправи с AI“ поправя черновата във формата, както е.
 */
function ImportDraft({
  suggestion,
  linked,
  sourceUrl,
}: {
  suggestion: ImportedSuggestion;
  linked: readonly Ingredient[];
  sourceUrl: string | undefined;
}) {
  const approve = useApproveSuggestion();
  const reject = useRejectSuggestion();
  const navigate = useNavigate();
  const { assumptions } = suggestion.payload;
  return (
    <>
      <section className="import-draft" aria-label="Чернова от внасяне">
        {assumptions && (
          <p className="import-draft__note">
            <strong>AI допусна:</strong> {assumptions}
          </p>
        )}
        <div className="form-actions">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button--quiet"
            >
              Отвори източника
            </a>
          )}
          <button
            type="button"
            className="button button--quiet"
            disabled={reject.isPending}
            onClick={() => {
              approve.reset();
              reject.mutate(suggestion.id);
            }}
          >
            Отхвърли
          </button>
        </div>
        {reject.isError && <ErrorBox error={reject.error} />}
      </section>
      <RevisableSuggestionForm
        key={suggestion.id}
        suggestionId={suggestion.id}
        initialValues={importToFormValues(
          suggestion.payload,
          linked,
          sourceUrl,
        )}
        isSubmitting={approve.isPending}
        submitError={approve.error}
        onSubmit={(input, revisionId) => {
          reject.reset();
          approve.mutate(
            // „Без уред“ е `null`: без поле api-то би взело уреда на предложението.
            {
              id: suggestion.id,
              input: {
                ...input,
                appliance: input.appliance ?? null,
                ...(revisionId ? { revisionId } : {}),
              },
            },
            {
              onSuccess: ({ recipe }) =>
                void navigate({
                  to: '/recipes/$id',
                  params: { id: recipe.id },
                }),
            },
          );
        }}
        onCancel={() => void navigate({ to: '/recipes/import' })}
      />
    </>
  );
}

/** Решена чернова: какво е решено и връзка към рецептата; отхвърлената има „Върни“ — пак е чернова. */
function Decided({ suggestion }: { suggestion: ImportedSuggestion }) {
  const restore = useRestoreSuggestion();
  return (
    <div className="recipes__empty">
      <p>
        {suggestion.status === 'approved'
          ? 'Черновата е записана като рецепта.'
          : 'Черновата е отхвърлена.'}
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

/** Същото внасяне наново: същият текст или същият линк; `undefined`, ако няма какво да се повтори. */
function retryParams({
  request,
  text,
}: RecipeImportDetail): RecipeImportParams | undefined {
  if (text !== undefined) {
    return { kind: 'text', text, ...(request.url ? { url: request.url } : {}) };
  }
  if (request.source === 'url' && request.url) {
    return { kind: 'url', url: request.url, force: true };
  }
  return undefined;
}

/**
 * Съобщение по кода и „Опитай пак“: ново внасяне на същия текст или линк. Страница, която не се прочете, води към таба
 * „Текст“ с пренесен линк. Снимката не се пази никъде, затова при снимка вместо „Опитай пак“ е „Нова снимка“.
 */
function ImportFailed({ detail }: { detail: RecipeImportDetail }) {
  const retry = useRequestImport();
  const navigate = useNavigate();
  const { request } = detail;
  const unreadable =
    request.error === 'fetch_blocked' || request.error === 'fetch_failed';
  const again = unreadable ? undefined : retryParams(detail);
  return (
    <>
      <div className="error-box" role="alert">
        <p>{importFailureMessage(request)}</p>
        <ImportSubject detail={detail} />
        <div className="form-actions">
          {unreadable && (
            <Link
              to="/recipes/import"
              search={{ tab: 'text', url: request.url }}
              className="button"
            >
              Постави текста
            </Link>
          )}
          {request.source === 'photo' && (
            <Link
              to="/recipes/import"
              search={{ tab: 'photo' }}
              className="button"
            >
              Нова снимка
            </Link>
          )}
          {detail.text !== undefined && (
            <Link
              to="/recipes/import"
              search={{ tab: 'text', text: detail.text, url: request.url }}
              className="button button--quiet"
            >
              Редактирай и опитай пак
            </Link>
          )}
          {again && (
            <button
              type="button"
              className="button"
              disabled={retry.isPending}
              onClick={() =>
                retry.mutate(again, {
                  onSuccess(next) {
                    void navigate({
                      to: '/recipes/import/$requestId',
                      params: { requestId: next.id },
                    });
                  },
                })
              }
            >
              Опитай пак
            </button>
          )}
        </div>
      </div>
      {retry.isError && <ErrorBox error={retry.error} />}
    </>
  );
}
