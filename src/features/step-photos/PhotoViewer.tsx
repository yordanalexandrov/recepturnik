import { stepPhotoUrl } from '@family/shared';
import { useEffect, useRef } from 'react';

interface PhotoViewerProps {
  photoId: string;
  /** Името на снимката, напр. „Снимката на стъпка 2“: и на прозореца, и на картината. */
  label: string;
  onClose: () => void;
}

/**
 * Снимка на стъпка в пълния ѝ размер, над екрана. Затваря се с „Затвори“, с натискане където и да е и с Escape.
 * Копие от family без записа в историята („назад“ на телефона), който там идва от листовете.
 */
export function PhotoViewer({ photoId, label, onClose }: PhotoViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        className="photo-viewer__backdrop"
        aria-label="Затвори снимката"
        tabIndex={-1}
        onClick={onClose}
      />
      <img
        className="photo-viewer__image"
        src={stepPhotoUrl(photoId)}
        alt={label}
      />
      <button
        ref={closeRef}
        type="button"
        className="button photo-viewer__close"
        onClick={onClose}
      >
        Затвори
      </button>
    </div>
  );
}
