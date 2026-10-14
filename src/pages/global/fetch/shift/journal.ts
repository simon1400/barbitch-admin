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

/**
 * s258: результат смены (месяц «до» → «после», как в плитке страницы) — в ту же запись
 * журнала; её читает главная владельца («Последняя закрытая смена»). Тоже без ожидания.
 */
export const reportShiftResult = (date: string, before: number, after: number): void => {
  void journalFetch('POST', '/result', { date, before, after }).catch((e) => console.error('shift-close result failed', e))
}
