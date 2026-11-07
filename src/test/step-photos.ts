import { stepPhotoResponseSchema } from '@family/shared';
import { HttpResponse, http } from 'msw';
import { onTestFinished, vi } from 'vitest';
import { recordForms, type SentForm } from './form-data';
import { server } from './msw';

/** Id-тата на качените снимки на стъпки, както `POST /api/step-photos` ги връща подред. */
export const stepPhotoIds = [
  'eeeeeeee-1111-4000-8000-000000000001',
  'eeeeeeee-1111-4000-8000-000000000002',
  'eeeeeeee-1111-4000-8000-000000000003',
] as const;

/** Снимка, както камерата или галерията на телефона я дава на file input-а. */
export function cameraPhoto(name = 'IMG_0001.jpg'): File {
  return new File(['camera bytes'], name, { type: 'image/jpeg' });
}

/**
 * Api-то на снимките на стъпки: всеки `POST /api/step-photos` връща следващото от `stepPhotoIds`, а декодирането и
 * canvas-ът на браузъра са имитирани (всяка снимка е 4032×3024 и става малък JPEG). Връща пратените формуляри
 * (`recordForms`) подред. Копие от family.
 */
export function serveStepPhotoUploads(): SentForm[] {
  const forms = recordForms();
  let next = 0;
  server.use(
    http.post('/api/step-photos', () => {
      const id = stepPhotoIds[next++];
      return HttpResponse.json(
        stepPhotoResponseSchema.parse({ photo: { id } }),
        {
          status: 201,
        },
      );
    }),
  );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 4032, height: 3024, close: vi.fn() })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => callback(new Blob(['small jpeg'], { type: 'image/jpeg' })),
  );
  onTestFinished(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  return forms;
}
