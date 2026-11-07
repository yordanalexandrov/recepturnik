import { type RecipeSummary, TAG_LABELS_BG } from '@family/shared';
import { Link } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { ErrorBox } from '../../components/ErrorBox';
import { Sheet } from '../../components/Sheet';
import { Spinner } from '../../components/Spinner';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useWideScreen } from '../../lib/use-media-query';
import {
  countFilters,
  hasFilters,
  NO_FILTERS,
  useStoredRecipeFilters,
} from './filters';
import { formatMinutes } from './format';
import { useRecipes } from './queries';
import { RecipeFiltersFields } from './RecipeFiltersFields';
import { StarsBadge } from './Stars';

const SEARCH_DEBOUNCE_MS = 300;

/** Защо списъкът е празен: празен регистър, търсене без резултат или филтри без резултат. */
function emptyMessage(
  registryEmpty: boolean,
  filtered: boolean,
  q: string,
): string {
  if (registryEmpty) {
    return 'Още няма рецепти.';
  }
  return q && !filtered
    ? `Няма рецепти за „${q}“.`
    : 'Няма рецепти по този избор.';
}

/** „3 рецепти“, „1 рецепта“; при търсене или филтър „1 от 3“. */
function resultCount(shown: number, total: number | undefined): string {
  if (total !== undefined) {
    return `${shown} от ${total}`;
  }
  return shown === 1 ? '1 рецепта' : `${shown} рецепти`;
}

/**
 * Регистърът рецепти: търсене по заглавие, филтри и карти. На широк екран филтрите са в страничен панел, а картите —
 * решетка; на тесен филтрите са в лист „Филтри“, а картите — една колона.
 */
export function RecipeList() {
  const wide = useWideScreen();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, SEARCH_DEBOUNCE_MS).trim();
  const [filters, setFilters] = useStoredRecipeFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const selectedCount = countFilters(filters);
  const recipes = useRecipes({ ...filters, q });
  // Целият регистър заедно с архивираните: знаменателят на „1 от 3“ и дали регистърът е празен. С „Покажи
  // архивираните“ и без търсене и тагове това е същото query като списъка.
  const registry = useRecipes({ includeArchived: true, sort: filters.sort });
  const total = filters.includeArchived
    ? registry.data?.length
    : registry.data?.filter((recipe) => !recipe.archivedAt).length;
  // Архивираните разширяват списъка, не го стесняват.
  const filtered = selectedCount > Number(filters.includeArchived);
  const narrowed = q !== '' || filtered;

  return (
    <main className="screen recipes">
      <div className="screen__header">
        <h1>Рецепти</h1>
        <input
          type="search"
          className="input recipes__search"
          aria-label="Търси"
          placeholder="Търси по заглавие"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {!wide && (
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setFiltersOpen(true)}
          >
            {selectedCount > 0 ? `Филтри (${selectedCount})` : 'Филтри'}
          </button>
        )}
        {!wide && hasFilters(filters) && (
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setFilters(NO_FILTERS)}
          >
            Изчисти
          </button>
        )}
      </div>

      {!wide && filtersOpen && (
        <Sheet title="Филтри" onClose={closeFilters}>
          <RecipeFiltersFields filters={filters} onChange={setFilters} />
        </Sheet>
      )}

      <div className="recipes__body">
        {wide && (
          <aside className="recipes__filters" aria-label="Филтри">
            <RecipeFiltersFields filters={filters} onChange={setFilters} />
          </aside>
        )}
        <div className="recipes__results">
          {recipes.isPending ? (
            <Spinner />
          ) : recipes.isError ? (
            <ErrorBox
              error={recipes.error}
              onRetry={() => void recipes.refetch()}
            />
          ) : (
            <>
              {(!narrowed || total !== undefined) && (
                <p className="recipes__count" aria-live="polite">
                  {resultCount(
                    recipes.data.length,
                    narrowed ? total : undefined,
                  )}
                </p>
              )}
              {recipes.data.length === 0 ? (
                <div className="recipes__empty">
                  <p>
                    {emptyMessage(registry.data?.length === 0, filtered, q)}
                  </p>
                  <Link to="/recipes/new" className="button">
                    Нова рецепта
                  </Link>
                </div>
              ) : (
                <ul className="recipe-cards">
                  {recipes.data.map((recipe) => (
                    <li key={recipe.id}>
                      <RecipeCard recipe={recipe} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/** Карта в регистъра: заглавие, време, оценка и тагове; цялата е връзка към рецептата. */
function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <Link to="/recipes/$id" params={{ id: recipe.id }} className="recipe-card">
      <span className="recipe-card__title">{recipe.title}</span>
      <span className="recipe-card__meta">
        {recipe.prepMinutes !== undefined && (
          <span>{formatMinutes(recipe.prepMinutes)}</span>
        )}
        <StarsBadge rating={recipe.rating} />
        {recipe.archivedAt && <span className="badge">архивирана</span>}
      </span>
      {recipe.tags.length > 0 && (
        <span className="recipe-card__tags">
          {recipe.tags.map((tag) => TAG_LABELS_BG[tag]).join(' · ')}
        </span>
      )}
    </Link>
  );
}
