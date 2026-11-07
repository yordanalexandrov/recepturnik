import { vi } from 'vitest';

/** Един файл от формуляр, пратен от приложението: полето, името, типът и размерът му. */
export interface SentFile {
  field: string;
  name: string;
  type: string;
  size: number;
}

/** Заявка с тяло `FormData`: пътят ѝ (без origin), Content-Type, както го е сложило приложението, и файловете ѝ. */
export interface SentForm {
  path: string;
  contentType: string | null;
  files: SentFile[];
}

/**
 * Записва формулярите (тела `FormData`), които приложението праща, и пуска всяка заявка без тялото ѝ, за да ѝ
 * отговори msw. Нужно е, защото `FormData` на jsdom държи Blob на jsdom, чиито байтове fetch на Node не чете, и msw
 * никога не вижда multipart тяло; самото разчитане на multipart е работа на api-то. Копие от family.
 */
export function recordForms(): SentForm[] {
  const sent: SentForm[] = [];
  const fetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (!(init?.body instanceof FormData)) {
      return fetch(input, init);
    }
    const files: SentFile[] = [];
    for (const [field, value] of init.body.entries()) {
      if (typeof value !== 'string') {
        files.push({
          field,
          name: value.name,
          type: value.type,
          size: value.size,
        });
      }
    }
    sent.push({
      path: new URL(String(input), window.location.href).pathname,
      contentType: new Headers(init.headers).get('content-type'),
      files,
    });
    const { body: _form, ...rest } = init;
    return fetch(input, rest);
  });
  return sent;
}
