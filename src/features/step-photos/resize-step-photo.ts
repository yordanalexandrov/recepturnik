import {
  IMPORT_PHOTO_JPEG_QUALITY,
  IMPORT_PHOTO_MAX_SIDE,
} from '@family/shared';
import { logger } from '../../logger';

/**
 * Снимка на стъпка (GLOSSARY на family: Снимка на стъпка), готова за качване: до 2000 px по дългата страна, изправена
 * по EXIF ориентацията, като JPEG — както `resizeStepPhoto` на family. Картина, която браузърът не може да декодира
 * (HEIC извън Safari), или неуспешно рисуване — отива както е: api-то я чете само.
 */
export async function resizeStepPhoto(photo: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(photo);
  } catch (error) {
    logger.warn('photo not decoded, sent as it is', error);
    return photo;
  }
  try {
    const scale = Math.min(
      1,
      IMPORT_PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      return photo;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', IMPORT_PHOTO_JPEG_QUALITY),
    );
    return jpeg ?? photo;
  } finally {
    bitmap.close();
  }
}
