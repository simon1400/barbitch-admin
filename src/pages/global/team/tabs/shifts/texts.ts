// Тексты редактора смен администраторов (s278): по-русски — руководству во вкладке
// «Команда → Смены администраторов», по-чешски — администраторкам во вкладке
// «Rozpis směn» модуля «Směna». Один экран, два словаря — чтобы не плодить копию вкладки.
import type { DayKey, ShiftsLang } from '../../fetch/shifts'

export interface ShiftsText {
  dayLabels: Record<DayKey, string>
  hint: string
  hintAdministrator: string
  loading: string
  loadError: string
  prev: string
  next: string
  thisWeek: string
  dirtyWeeks: (n: number) => string
  allDays: string
  confirmLeave: string
  confirmDelete: (range: string) => string
  noteUnchanged: string
  noteSaved: string
  noteDeleted: string
  badgeCurrent: string
  badgePast: string
  badgeNone: string
  badgeUnpublished: string
  badgeUnpublishedTitle: string
  badgeDuplicate: string
  badgeDirty: string
  badgeLocked: string
  placeholder: string
  other: string
  pickFromList: string
  incomplete: string
  save: string
  saving: string
  reset: string
  copyPrev: string
  copyPrevTitle: string
  copyPrevNone: string
  remove: string
}

const RU: ShiftsText = {
  dayLabels: { monday: 'Пн', tuesday: 'Вт', wednesday: 'Ср', thursday: 'Чт', friday: 'Пт', saturday: 'Сб', sunday: 'Вс' },
  hint:
    'Кто из администраторов дежурит в какой день. График сразу видят календарь (плашка над сеткой), «Сегодня» и отчёт дозаписей. В списке — имена из недавних недель; новое имя или «Ремонт» — через «Другое…». Администраторки заполняют график сами в своём модуле «Rozpis směn» (прошлые недели — только отсюда).',
  hintAdministrator: '',
  loading: 'Načítání…',
  loadError: 'Не удалось загрузить график',
  prev: 'Раньше',
  next: 'Позже',
  thisWeek: 'К этой неделе',
  dirtyWeeks: (n) => `не сохранено недель: ${n}`,
  allDays: 'Все 7 дней обязательны: «-» — если дежурного нет.',
  confirmLeave: 'Есть несохранённые правки графика. Уйти без сохранения?',
  confirmDelete: (range) => `Удалить график недели ${range}? В календаре будет «rozpis není vyplněn».`,
  noteUnchanged: 'Без изменений.',
  noteSaved: 'Сохранено — календарь уже показывает этот график.',
  noteDeleted: 'График недели удалён.',
  badgeCurrent: 'эта неделя',
  badgePast: 'прошла',
  badgeNone: 'графика нет',
  badgeUnpublished: 'не опубликовано',
  badgeUnpublishedTitle: 'Запись из Strapi без публикации — «Сохранить» опубликует',
  badgeDuplicate: 'две записи на неделю',
  badgeDirty: 'не сохранено',
  badgeLocked: 'только чтение',
  placeholder: 'Имя или «Ремонт»',
  other: 'Другое…',
  pickFromList: 'Выбрать из списка',
  incomplete: 'Заполните все 7 дней — «-», если дежурного нет.',
  save: 'Сохранить',
  saving: 'Сохраняю…',
  reset: 'Отменить правки',
  copyPrev: 'Как прошлая неделя',
  copyPrevTitle: 'Заполнить днями прошлой недели (сохраняется кнопкой «Сохранить»)',
  copyPrevNone: 'У прошлой недели графика нет',
  remove: 'Удалить график',
}

const CS: ShiftsText = {
  dayLabels: { monday: 'Po', tuesday: 'Út', wednesday: 'St', thursday: 'Čt', friday: 'Pá', saturday: 'So', sunday: 'Ne' },
  hint: '',
  hintAdministrator:
    'Kdo z administrátorek má který den směnu. Rozpis hned vidí kalendář (lišta nad mřížkou) i vedení. Vyplňujte tento a další týdny — minulé týdny mění jen vedení. V seznamu jsou jména z posledních týdnů; nové jméno nebo „Oprava“ přes „Jiné…“.',
  loading: 'Načítání…',
  loadError: 'Rozpis se nepodařilo načíst',
  prev: 'Dřívější týdny',
  next: 'Pozdější týdny',
  thisWeek: 'Na tento týden',
  dirtyWeeks: (n) => `neuloženo týdnů: ${n}`,
  allDays: 'Všech 7 dní je povinných: „-“ — pokud nikdo nemá směnu.',
  confirmLeave: 'Rozpis má neuložené změny. Odejít bez uložení?',
  confirmDelete: (range) => `Smazat rozpis týdne ${range}?`,
  noteUnchanged: 'Beze změny.',
  noteSaved: 'Uloženo — kalendář už tento rozpis ukazuje.',
  noteDeleted: 'Rozpis týdne smazán.',
  badgeCurrent: 'tento týden',
  badgePast: 'minulý',
  badgeNone: 'rozpis chybí',
  badgeUnpublished: 'nepublikováno',
  badgeUnpublishedTitle: 'Záznam ze Strapi bez publikace — „Uložit“ ho publikuje',
  badgeDuplicate: 'dva záznamy na týden',
  badgeDirty: 'neuloženo',
  badgeLocked: 'jen ke čtení',
  placeholder: 'Jméno nebo „Oprava“',
  other: 'Jiné…',
  pickFromList: 'Vybrat ze seznamu',
  incomplete: 'Vyplňte všech 7 dní — „-“, pokud nikdo nemá směnu.',
  save: 'Uložit',
  saving: 'Ukládám…',
  reset: 'Zrušit změny',
  copyPrev: 'Jako minulý týden',
  copyPrevTitle: 'Vyplnit dny minulého týdne (uloží se tlačítkem „Uložit“)',
  copyPrevNone: 'Minulý týden rozpis nemá',
  remove: 'Smazat rozpis',
}

export const SHIFTS_TEXT: Record<ShiftsLang, ShiftsText> = { ru: RU, cs: CS }
