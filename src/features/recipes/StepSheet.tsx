import { Field } from '../../components/Field';
import { Sheet } from '../../components/Sheet';
import { StepPhotoField } from '../step-photos/StepPhotoField';

interface StepSheetProps {
  /** Номерът на стъпката, от 1. */
  number: number;
  count: number;
  text: string;
  photoId: string | undefined;
  /** Грешката на стъпката от последния опит за запис. */
  error?: string | undefined;
  onChange: (text: string) => void;
  /** Новата снимка (вече качена) или `undefined` при „Махни“. */
  onPhotoChange: (photoId: string | undefined) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Лист за една стъпка в `RecipeForm`: текстът, снимката, „По-нагоре“, „По-надолу“ и „Премахни стъпка“. От family. */
export function StepSheet({
  number,
  count,
  text,
  photoId,
  error,
  onChange,
  onPhotoChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onClose,
}: StepSheetProps) {
  return (
    <Sheet title="Стъпка" onClose={onClose} focusField>
      <Field label={`Стъпка ${number}`} error={error}>
        {(props) => (
          <textarea
            {...props}
            className="input step-sheet__text"
            rows={5}
            value={text}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </Field>
      <StepPhotoField
        number={number}
        photoId={photoId}
        onChange={onPhotoChange}
      />
      <div className="form-actions">
        <button
          type="button"
          className="button button--quiet"
          disabled={number === 1}
          onClick={onMoveUp}
        >
          По-нагоре
        </button>
        <button
          type="button"
          className="button button--quiet"
          disabled={number === count}
          onClick={onMoveDown}
        >
          По-надолу
        </button>
        <button
          type="button"
          className="button button--quiet"
          onClick={onRemove}
        >
          Премахни стъпка
        </button>
      </div>
    </Sheet>
  );
}
