import {
  HINT_MAX,
  PREP_TIME_LABELS_BG,
  type PrepTimeRange,
  prepTimeRangeSchema,
  type RecipeSuggestParams,
  type Slot,
  slotSchema,
  TAG_LABELS_BG,
  type Tag,
  tagSchema,
} from '@family/shared';
import { type FormEvent, useState } from 'react';
import { ChoiceChips, toggled } from '../../components/ChoiceChips';
import { ErrorBox } from '../../components/ErrorBox';
import { Field } from '../../components/Field';
import { useAppliances } from '../appliances/queries';
import { applianceShortName } from '../recipes/format';

/** Таговете без храненията: храненето се избира отделно. */
const EXTRA_TAGS = tagSchema.options.filter(
  (tag) => !(slotSchema.options as readonly string[]).includes(tag),
);

interface SuggestFormProps {
  onSubmit: (params: RecipeSuggestParams) => void;
  isSubmitting?: boolean;
  submitError?: unknown;
}

/** Хранене (поне едно), време, тагове и подсказка за `recipe.suggest`; навсякъде може да са избрани няколко. */
export function SuggestForm({
  onSubmit,
  isSubmitting = false,
  submitError,
}: SuggestFormProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [times, setTimes] = useState<PrepTimeRange[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [hint, setHint] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (slots.length === 0) {
      return;
    }
    const trimmed = hint.trim();
    onSubmit({
      slots,
      ...(times.length > 0 ? { times } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(trimmed ? { hint: trimmed } : {}),
    });
  }

  return (
    <form className="suggest-form" noValidate onSubmit={submit}>
      <ChoiceChips<Slot>
        label="Хранене"
        options={slotSchema.options}
        labels={TAG_LABELS_BG}
        selected={slots}
        onToggle={(slot) => setSlots((current) => toggled(current, slot))}
      />
      <ChoiceChips<PrepTimeRange>
        label="Време"
        options={prepTimeRangeSchema.options}
        labels={PREP_TIME_LABELS_BG}
        selected={times}
        onToggle={(time) => setTimes((current) => toggled(current, time))}
      />
      <ChoiceChips<Tag>
        label="Тагове"
        options={EXTRA_TAGS}
        labels={TAG_LABELS_BG}
        selected={tags}
        onToggle={(tag) => setTags((current) => toggled(current, tag))}
      />
      <Field label="Подсказка">
        {(props) => (
          <input
            {...props}
            className="input"
            maxLength={HINT_MAX}
            placeholder="напр. нещо с пиле"
            value={hint}
            onChange={(event) => setHint(event.target.value)}
          />
        )}
      </Field>
      <AppliancesLine />
      {submitError !== undefined && submitError !== null && (
        <ErrorBox error={submitError} />
      )}
      <button
        type="submit"
        className="button"
        disabled={slots.length === 0 || isSubmitting}
      >
        Поискай предложения
      </button>
    </form>
  );
}

/**
 * „Уреди: air fryer, sous vide — предпочитани“: включените уреди, които заявката взема предвид. Само за четене: уредите
 * се сменят в Настройки на family.
 */
function AppliancesLine() {
  const appliances = useAppliances();
  if (!appliances.data) {
    return null;
  }
  const names = appliances.data
    .filter((appliance) => appliance.enabled)
    .map((appliance) => applianceShortName(appliance.name));
  return (
    <p className="muted">
      {names.length > 0
        ? `Уреди: ${names.join(', ')} — предпочитани`
        : 'Уреди: няма включени'}
    </p>
  );
}
