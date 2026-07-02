// Глобальная константа скидки для junior-мастеров.
// Применяется к ИТОГОВОЙ цене (-20% на всё, включая базу + варианты + modifiers).
// При изменении — синхронизировать с client/src/constants/junior.ts и пересоздать junior event_types в Noona.
export const JUNIOR_DISCOUNT_PERCENT = 20

export const calcJuniorPrice = (seniorPrice: number): number =>
  Math.round(seniorPrice * (1 - JUNIOR_DISCOUNT_PERCENT / 100))

// Junior-длительность = senior-длительности (наценка +50% отменена, s95).
// Если наценку вернут — восстановить формулу ×(1+markup/100) с округлением до 5 мин
// и пере-синкать существующие junior event_types (backup/junior_duration_sync.mjs).
export const calcJuniorDuration = (seniorDuration: number): number => seniorDuration
