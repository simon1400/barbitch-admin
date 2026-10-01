// Дни рождения сотрудников (s221): у кого из активных сотрудников день рождения в
// ближайшие 30 дней; если ни у кого — самый ближайший. Карточка на «Сегодня» (руководство) и в кабинете администратора.
//
// 🟥 Данные — ТОЛЬКО ручка движка. Дата рождения лежит в компоненте
// `personal.oficial` рядом с номером документа и адресами; сессии сотрудника сервер
// этот компонент не отдаёт вовсе (403 на запрос, вырезается из ответа). Сюда
// приходят день и месяц — года рождения и возраста в ответе нет.
import { makeApiFetch } from './apiFetch'

export interface Birthday {
  /** documentId карточки; у постоянных дат (s237) — 'owner' / 'salon' */
  docId: string
  name: string
  /** 'master' | 'administrator' | 'manager'; постоянные даты — 'owner' | 'salon' */
  position: string | null
  day: number
  month: number
  /** дата ближайшего дня рождения, YYYY-MM-DD */
  next: string
  /** 0 — сегодня */
  daysLeft: number
  /** только у салона: сколько лет исполняется */
  years?: number
}

export interface Birthdays {
  today: string
  horizonDays: number
  items: Birthday[]
  /** в горизонт не попал никто — в items самый ближайший день рождения */
  nearestOnly?: boolean
  /** сотрудники, у которых дата в карточке не распознана; приходит только руководству */
  unknown: string[]
}

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Сессия истекла — войдите снова.',
}

const birthdaysFetch = makeApiFetch('/api', CODE_MESSAGES, (status) => `Ошибка ${status}`)

export const fetchBirthdays = () => birthdaysFetch<Birthdays>('GET', '/engine/admin/birthdays')

const POSITION_RU: Record<string, string> = {
  master: 'мастер',
  administrator: 'администратор',
  manager: 'управляющая',
  owner: 'владелец',
}

const yearsRu = (n: number): string => {
  const d10 = n % 10
  const d100 = n % 100
  if (d10 === 1 && d100 !== 11) return `${n} год`
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return `${n} года`
  return `${n} лет`
}

/** Подпись под именем: должность; у салона — «салону N лет». */
export const birthdayLabel = (b: Pick<Birthday, 'position' | 'years'>): string =>
  b.position === 'salon' ? (b.years ? `салону ${yearsRu(b.years)}` : 'день рождения салона') : (b.position && POSITION_RU[b.position]) || ''

/** «сегодня» / «завтра» / «через N дн.» */
export const daysLeftLabel = (daysLeft: number): string =>
  daysLeft === 0 ? 'сегодня' : daysLeft === 1 ? 'завтра' : `через ${daysLeft} дн.`
