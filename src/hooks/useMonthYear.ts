import { useState } from 'react'
import { todayDate } from '../utils/date'

/**
 * Пара «месяц + год» для селекторов периода — она была дословно повторена в
 * десяти файлах.
 *
 * 🟥 Умолчание берётся от ТЕКУЩЕГО ДНЯ САЛОНА, а не от часов браузера. Раньше
 * стояло `new Date().getMonth()`: у владельца в поездке первого числа месяца
 * (или последнего вечером) страница открывалась на СОСЕДНЕМ месяце — «Результат
 * месяца», зарплаты и налоги показывали не тот период, причём без всякого
 * признака ошибки (s186).
 *
 * Значение считается лениво: `useState(new Date()…)` создавал объект даты на
 * каждый рендер, хотя нужен он только при первом.
 *
 * month — 0-based, как `Date.getMonth()`.
 */
export const useMonthYear = () => {
  const [month, setMonth] = useState<number>(() => todayDate().getMonth())
  const [year, setYear] = useState<number>(() => todayDate().getFullYear())
  return { month, setMonth, year, setYear }
}
