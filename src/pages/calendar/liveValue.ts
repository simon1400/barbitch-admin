// Значение, которое меняется чаще, чем имеет смысл перерисовывать дерево.
//
// 🟥 ЗАЧЕМ. В гриде календаря два таких значения: подсвеченный получасовой слот под
// курсором и координаты пальца при переносе брони. Оба лежали в useState самого
// грида, поэтому одно движение мыши через границу слота (а на планшете — КАЖДОЕ
// событие touchmove во время переноса) перерисовывало весь день: все колонки, все
// карточки броней, блоки, часовые линии. Ради одного полупрозрачного прямоугольника
// и подписи на «призраке».
//
// Здесь значение живёт вне React, а подписываются на него только те крошечные
// компоненты, которые его рисуют (`useSyncExternalStore`). Грид при этом не
// перерисовывается вовсе.
//
// ⚠️ `get` обязан возвращать СТАБИЛЬНУЮ ссылку, пока значение не менялось, иначе
// useSyncExternalStore уходит в бесконечный рендер. Поэтому `set` хранит ровно то,
// что ему передали, и умеет сравнивать «то же самое» через `same` (у слота это
// колонка+минута: провести мышью внутри одной клетки = ничего не произошло).

import { useSyncExternalStore } from 'react'

export interface LiveValue<T> {
  get: () => T
  set: (next: T) => void
  subscribe: (onChange: () => void) => () => void
}

export function createLiveValue<T>(
  initial: T,
  same: (a: T, b: T) => boolean = Object.is,
): LiveValue<T> {
  let value = initial
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      if (same(value, next)) return
      value = next
      for (const fn of [...subs]) fn()
    },
    subscribe(onChange: () => void) {
      subs.add(onChange)
      return () => {
        subs.delete(onChange)
      }
    },
  }
}

export function useLiveValue<T>(live: LiveValue<T>): T {
  return useSyncExternalStore(live.subscribe, live.get)
}
