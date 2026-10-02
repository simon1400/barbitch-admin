// Журнал «Uzavření směny» (s240, «Výkaz práce» §10.6): публикация дня идёт сырым REST из
// браузера, сервер о ней иначе не узнает — после публикации сообщаем итог ручке движка
// (автора сервер берёт из сессии, число услуг дня считает сам). Без ожидания: сбой журнала
// закрытие смены не ломает.
import { makeApiFetch } from '../../../../lib/apiFetch'

const journalFetch = makeApiFetch('/api/engine/admin/shift-close', {}, (s) => `Chyba ${s}`)

export const reportShiftClose = (date: string, published: number, failures: number, skipped: number): void => {
  void journalFetch('POST', '/journal', { date, published, failures, skipped }).catch((e) =>
    console.error('shift-close journal failed', e),
  )
}
