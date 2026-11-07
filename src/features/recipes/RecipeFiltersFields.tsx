import {
  PREP_TIME_LABELS_BG,
  type PrepTimeRange,
  prepTimeRangeSchema,
  type RecipesSort,
  recipesSortSchema,
  TAG_LABELS_BG,
  type Tag,
  tagSchema,
} from '@family/shared';
import { hasFilters, NO_FILTERS, type RecipeFilters } from './filters';

const SORT_LABELS: Record<RecipesSort, string> = {
  title: 'по име',
  rating: 'по оценка',
};

/** `list` с `value`, ако го няма, иначе без него: мулти изборът след натискане на чип. */
function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

interface ChoiceChipsProps<T extends string> {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: readonly T[];
  onToggle: (value: T) => void;
}

/** Фиксиран списък стойности като toggle бутони (`aria-pressed`); може да са избрани няколко. */
function ChoiceChips<T extends string>({
  label,
  options,
  labels,
  selected,
  onToggle,
}: ChoiceChipsProps<T>) {
  return (
    <fieldset className="filters__group">
      <legend>{label}</legend>
      <div className="chips">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            className="chip"
            aria-pressed={selected.includes(value)}
            onClick={() => onToggle(value)}
          >
            {labels[value]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Полетата на филтрите (в страничния панел или в листа „Филтри“); всеки избор се прилага веднага. */
export function RecipeFiltersFields({
  filters,
  onChange,
}: {
  filters: RecipeFilters;
  onChange: (filters: RecipeFilters) => void;
}) {
  return (
    <div className="filters">
      {hasFilters(filters) && (
        <button
          type="button"
          className="button button--quiet"
          onClick={() => onChange(NO_FILTERS)}
        >
          Изчисти
        </button>
      )}
      <ChoiceChips<Tag>
        label="Таг"
        options={tagSchema.options}
        labels={TAG_LABELS_BG}
        selected={filters.tags}
        onToggle={(tag) =>
          onChange({ ...filters, tags: toggled(filters.tags, tag) })
        }
      />
      <ChoiceChips<PrepTimeRange>
        label="Време"
        options={prepTimeRangeSchema.options}
        labels={PREP_TIME_LABELS_BG}
        selected={filters.times}
        onToggle={(time) =>
          onChange({ ...filters, times: toggled(filters.times, time) })
        }
      />
      <fieldset className="filters__group">
        <legend>Подреди</legend>
        <div className="chips">
          {recipesSortSchema.options.map((sort) => (
            <label key={sort} className="chip">
              <input
                type="radio"
                name="recipes-sort"
                checked={filters.sort === sort}
                onChange={() => onChange({ ...filters, sort })}
              />
              {SORT_LABELS[sort]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="filters__check">
        <input
          type="checkbox"
          checked={filters.includeArchived}
          onChange={(event) =>
            onChange({ ...filters, includeArchived: event.target.checked })
          }
        />
        Покажи архивираните
      </label>
    </div>
  );
}
