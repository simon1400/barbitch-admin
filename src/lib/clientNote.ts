// Заметка о клиентке (s267): «velmi husté řasy», «alergie na lepidlo X».
// Одна на карточку клиента, видна на каждой её брони — в отличие от позна́мки
// брони (`booking.comment`), которая живёт у одной записи.
//
// Хранится в поле `clients.notes`. Туда же слияние дублей пишет техническую
// строку «Sloučeno 2026-09-12: … (id=123)» — её не показываем; сервер при
// правке её сохраняет. Календарь получает уже чистое `clientNote` от движка;
// здесь — для поиска клиента, который читает поле REST-ом сырым.
//
// 🟥 Зеркало strapi/src/utils/client-note.ts — регулярка и лимит должны
// совпадать (сверяет strapi/tests/client-note.test.mjs).

export const CLIENT_NOTE_MAX = 1000

const MERGE_LINE_RE = /^Sloučeno \d{4}-\d{2}-\d{2}: .*\(id=\d+\)\s*$/

/** Текст заметки для людей: без строк слияния дублей; пусто → null. */
export const clientNoteOf = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  const text = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => !MERGE_LINE_RE.test(l))
    .join('\n')
    .trim()
  return text || null
}
