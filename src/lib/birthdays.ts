// Дни рождения сотрудников (s221): у кого из активных сотрудников день рождения в
// ближайшие 30 дней; если ни у кого — самый ближайший. Карточка на «Сегодня» (руководство) и в кабинете администратора.
//
// 🟥 Данные — ТОЛЬКО ручка движка. Дата рождения лежит в компоненте
// `personal.oficial` рядом с номером документа и адресами; сессии сотрудника сервер
// этот компонент не отдаёт вовсе (403 на запрос, вырезается из ответа). Сюда
// приходят день и месяц — года рождения и возраста в ответе нет.
import { makeApiFetch } from './apiFetch'

export interface Birthday {
  docId: string
  name: string
  /** 'master' | 'administrator' | 'manager' */
  position: string | null
  day: number
  month: number
  /** дата ближайшего дня рождения, YYYY-MM-DD */
  next: string
  /** 0 — сегодня */
  daysLeft: number
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
}

export const positionLabel = (position: string | null): string => (position && POSITION_RU[position]) || ''

/** «сегодня» / «завтра» / «через N дн.» */
export const daysLeftLabel = (daysLeft: number): string =>
  daysLeft === 0 ? 'сегодня' : daysLeft === 1 ? 'завтра' : `через ${daysLeft} дн.`
