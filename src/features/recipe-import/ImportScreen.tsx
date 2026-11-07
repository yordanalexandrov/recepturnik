import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { RecentAiRequests } from '../ai/RecentAiRequests';
import { ImportLinkForm } from './ImportLinkForm';
import { ImportPhotoForm } from './ImportPhotoForm';
import { type ImportTextDraft, ImportTextForm } from './ImportTextForm';
import { importLabel } from './messages';
import {
  type ImportRequestParams,
  useRecentImports,
  useRequestImport,
} from './queries';

type ImportTab = 'text' | 'url' | 'photo';

const TABS: { id: ImportTab; label: string }[] = [
  { id: 'text', label: 'Текст' },
  { id: 'url', label: 'Линк' },
  { id: 'photo', label: 'Снимка' },
];

/**
 * Search на `/recipes/import`: `?tab=text|url|photo` избира таба, а `url` и `text` попълват полетата му (напр.
 * „Постави текста“ след страница, която не се прочете). Без share target на PWA-то на family.
 */
export interface ImportSearch {
  tab?: ImportTab | undefined;
  url?: string | undefined;
  text?: string | undefined;
}

/**
 * Невалидният параметър става изрично `undefined`: router-ът слива резултата върху суровия search на root route-а,
 * така че изпуснат ключ би оставил суровата стойност.
 */
export function parseImportSearch(
  search: Record<string, unknown>,
): ImportSearch {
  const text = (value: unknown) =>
    typeof value === 'string' && value.trim() !== '' ? value : undefined;
  return {
    tab: TABS.some(({ id }) => id === search.tab)
      ? (search.tab as ImportTab)
      : undefined,
    url: text(search.url),
    text: text(search.text),
  };
}

/** `/recipes/import` („Внеси рецепта“): табовете за източника и последните внасяния под тях. */
export function ImportScreen() {
  const search = useSearch({ from: '/recipes/import' });
  const recentImports = useRecentImports();
  // Табът „Текст“ се демонтира при друг таб: поставеното остава тук, за да е там при връщане.
  const [textDraft, setTextDraft] = useState<ImportTextDraft>(() => ({
    text: search.text ?? '',
    url: search.url ?? '',
  }));
  const [tab, setTab] = useState<ImportTab>(search.tab ?? 'text');
  const requestImport = useRequestImport();
  const navigate = useNavigate();

  const submit = (params: ImportRequestParams) =>
    requestImport.mutate(params, {
      onSuccess(request) {
        void navigate({
          to: '/recipes/import/$requestId',
          params: { requestId: request.id },
        });
      },
    });
  const formProps = {
    isSubmitting: requestImport.isPending,
    submitError: requestImport.error,
    onSubmit: submit,
  };

  return (
    <main className="screen">
      <header className="screen__header">
        <h1>Внеси рецепта</h1>
        <Link to="/recipes">← Рецепти</Link>
      </header>
      <div className="tabs" role="tablist" aria-label="Източник">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`import-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`import-panel-${id}`}
            className="tabs__tab"
            onClick={() => {
              setTab(id);
              requestImport.reset();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`import-panel-${tab}`}
        aria-labelledby={`import-tab-${tab}`}
        className="tabs__panel"
      >
        {tab === 'photo' ? (
          <ImportPhotoForm {...formProps} />
        ) : tab === 'text' ? (
          <ImportTextForm
            {...formProps}
            initialText={textDraft.text}
            initialUrl={textDraft.url}
            onDraftChange={setTextDraft}
          />
        ) : (
          <ImportLinkForm {...formProps} initialUrl={search.url} />
        )}
      </div>
      <RecentAiRequests
        title="Последни внасяния"
        empty="Още няма внасяния."
        requests={recentImports}
        to="/recipes/import/$requestId"
        label={importLabel}
      />
    </main>
  );
}
