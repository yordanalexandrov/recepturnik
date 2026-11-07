import { type RecipeSummary, TAG_LABELS_BG } from '@family/shared';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { formatMinutes } from './format';
import { useRecipes } from './queries';
import { StarsBadge } from './Stars';

const SEARCH_DEBOUNCE_MS = 300;

/** Регистърът рецепти: търсене по заглавие и карти (решетка на широк екран, една колона на тесен). */
export function RecipeList() {
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, SEARCH_DEBOUNCE_MS).trim();
  const recipes = useRecipes({ q });

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
      </div>

      {recipes.isPending ? (
        <Spinner />
      ) : recipes.isError ? (
        <ErrorBox
          error={recipes.error}
          onRetry={() => void recipes.refetch()}
        />
      ) : recipes.data.length === 0 ? (
        <div className="recipes__empty">
          <p>{q ? `Няма рецепти за „${q}“.` : 'Още няма рецепти.'}</p>
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
      </span>
      {recipe.tags.length > 0 && (
        <span className="recipe-card__tags">
          {recipe.tags.map((tag) => TAG_LABELS_BG[tag]).join(' · ')}
        </span>
      )}
    </Link>
  );
}
