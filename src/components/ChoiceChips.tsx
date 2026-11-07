/** `list` с `value`, ако го няма, иначе без него: мулти изборът след натискане на чип. */
export function toggled<T>(list: readonly T[], value: T): T[] {
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
  className?: string;
}

/** Фиксиран списък стойности като toggle бутони (`aria-pressed`) под легенда; може да са избрани няколко. */
export function ChoiceChips<T extends string>({
  label,
  options,
  labels,
  selected,
  onToggle,
  className = 'filters__group',
}: ChoiceChipsProps<T>) {
  return (
    <fieldset className={className}>
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
