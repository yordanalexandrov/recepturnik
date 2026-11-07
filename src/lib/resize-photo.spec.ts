import { afterEach, describe, expect, it, vi } from 'vitest';
import { resizeStepPhoto } from './resize-photo';

/** Браузърът декодира всяка снимка като `width`×`height`; връща нарисуваните размери на платното. */
function decodeAs(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height, close: vi.fn() })),
  );
  const drawn: { width: number; height: number }[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
  ) {
    drawn.push({ width: this.width, height: this.height });
    callback(new Blob(['jpeg'], { type: 'image/jpeg' }));
  });
  return drawn;
}

const photo = new File(['camera bytes'], 'IMG_0001.HEIC', {
  type: 'image/heic',
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resizeStepPhoto', () => {
  it('смалява снимката до 2000 px по дългата страна, като JPEG', async () => {
    const drawn = decodeAs(4032, 3024);

    const resized = await resizeStepPhoto(photo);

    expect(drawn).toEqual([{ width: 2000, height: 1500 }]);
    expect(resized.type).toBe('image/jpeg');
  });

  it('не уголемява малка снимка', async () => {
    const drawn = decodeAs(800, 600);

    await resizeStepPhoto(photo);

    expect(drawn).toEqual([{ width: 800, height: 600 }]);
  });

  it('снимка, която браузърът не декодира, отива както е', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new DOMException('not decoded', 'InvalidStateError');
      }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await resizeStepPhoto(photo)).toBe(photo);
  });
});
