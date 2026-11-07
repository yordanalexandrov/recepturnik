import {
  IMPORT_PHOTO_JPEG_QUALITY,
  IMPORT_PHOTO_MAX_SIDE,
  importPhotoLayout,
} from '@family/shared';
import { logger } from '../logger';

// Смаляването на снимки в браузъра преди качване (внасяне от снимка, снимка на стъпка), по
// `features/recipe-import/resize-photo.ts` на family. Двете са с качеството на JPEG от внасянето.

/**
 * Най-дългата страна на качената снимка на стъпка: колкото на една снимка от внасяне, както във family; api-то я
 * пази до `STEP_PHOTO_MAX_SIDE` (ADR-0008 на family).
 */
const STEP_PHOTO_UPLOAD_MAX_SIDE = IMPORT_PHOTO_MAX_SIDE;

/**
 * Снимката, готова за внасяне, по `importPhotoLayout` (както във family): до 2000 px по дългата
 * страна, изправена по EXIF ориентацията, като JPEG (по-малка заявка и по-бърз агент); дълъг скрийншот — четимо
 * широк и нарязан на до 8 части отгоре надолу. Картина, която браузърът не може да декодира (HEIC извън Safari),
 * отива както е — api-то и OpenClaw я приемат до 10 MB.
 */
export async function resizeImportPhoto(photo: Blob): Promise<Blob[]> {
  return (
    (await withBitmap(photo, async (bitmap) => {
      const layout = importPhotoLayout(bitmap.width, bitmap.height);
      const parts: Blob[] = [];
      for (const tile of layout.tiles) {
        const jpeg = await drawJpeg(bitmap, {
          width: layout.width,
          height: layout.height,
          top: tile.top,
          canvasHeight: tile.height,
        });
        if (!jpeg) {
          return undefined;
        }
        parts.push(jpeg);
      }
      return parts;
    })) ?? [photo]
  );
}

/**
 * Снимка на стъпка (GLOSSARY на family: Снимка на стъпка), готова за качване: до `STEP_PHOTO_UPLOAD_MAX_SIDE` по
 * дългата страна, изправена по EXIF ориентацията, като JPEG, цялата, без нарязване. Картина, която браузърът не може да
 * декодира (HEIC извън Safari), или неуспешно рисуване — отива както е: api-то я чете само.
 */
export async function resizeStepPhoto(photo: Blob): Promise<Blob> {
  return (
    (await withBitmap(photo, (bitmap) => {
      const scale = Math.min(
        1,
        STEP_PHOTO_UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);
      return drawJpeg(bitmap, { width, height, top: 0, canvasHeight: height });
    })) ?? photo
  );
}

/** `draw` с декодираната снимка; `undefined`, ако браузърът не я декодира или `draw` не успее. */
async function withBitmap<T>(
  photo: Blob,
  draw: (bitmap: ImageBitmap) => Promise<T | undefined | null>,
): Promise<T | undefined> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(photo);
  } catch (error) {
    logger.warn('photo not decoded, sent as it is', error);
    return undefined;
  }
  try {
    return (await draw(bitmap)) ?? undefined;
  } finally {
    bitmap.close();
  }
}

/** Снимката, нарисувана `width`×`height` от `top` надолу в платно `canvasHeight` високо, като JPEG. */
async function drawJpeg(
  bitmap: ImageBitmap,
  {
    width,
    height,
    top,
    canvasHeight,
  }: { width: number; height: number; top: number; canvasHeight: number },
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = canvasHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  context.drawImage(bitmap, 0, -top, width, height);
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', IMPORT_PHOTO_JPEG_QUALITY),
  );
}
