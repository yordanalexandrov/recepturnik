import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordForms } from '../../test/form-data';
import { pendingDetail, pendingImport, serveImport } from '../../test/imports';
import { renderApp } from '../../test/render';

/** Декодирането и платното на браузъра: всяка снимка е `width`×`height` и става малък JPEG. */
function mockCanvas(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height, close: vi.fn() })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => callback(new Blob(['small jpeg'], { type: 'image/jpeg' })),
  );
}

beforeEach(() => {
  // jsdom няма object URL-и; прегледът иска само един.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Внеси рецепта → таб „Снимка“', () => {
  it('„Внеси“ е неактивен без снимка; избраната снимка се смалява и отива като JPEG в полето photo', async () => {
    const user = userEvent.setup();
    serveImport({
      ...pendingDetail,
      request: { ...pendingImport, source: 'photo', url: undefined },
      text: undefined,
    });
    const forms = recordForms();
    mockCanvas(1200, 1600);

    renderApp('/recipes/import');
    await user.click(await screen.findByRole('tab', { name: 'Снимка' }));

    expect(screen.getByRole('button', { name: 'Внеси' })).toBeDisabled();
    // Камерата на телефона и файл от компютъра; и двата приемат само снимки.
    expect(screen.getByLabelText('Снимай')).toHaveAttribute(
      'capture',
      'environment',
    );
    expect(screen.getByLabelText('Избери файл')).toHaveAttribute(
      'accept',
      'image/*',
    );
    const photo = new File(['big photo'], 'recepta.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Избери файл'), photo);

    expect(
      await screen.findByRole('img', { name: 'Снимката за внасяне' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Внеси' }));

    expect(
      await screen.findByText('Чета рецептата… обикновено отнема до минута'),
    ).toBeInTheDocument();
    expect(forms).toEqual([
      {
        url: expect.stringMatching(/\/api\/recipe-imports$/),
        contentType: null,
        files: [
          { field: 'photo', name: 'photo.jpg', type: 'image/jpeg', size: 10 },
        ],
      },
    ]);
  });
});
