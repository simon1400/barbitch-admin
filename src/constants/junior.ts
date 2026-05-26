// Глобальная константа скидки для junior-мастеров.
// Применяется к ИТОГОВОЙ цене (-20% на всё, включая базу + варианты + modifiers).
// При изменении — синхронизировать с client/src/constants/junior.ts и пересоздать junior event_types в Noona.
export const JUNIOR_DISCOUNT_PERCENT = 20

export const calcJuniorPrice = (seniorPrice: number): number =>
  Math.round(seniorPrice * (1 - JUNIOR_DISCOUNT_PERCENT / 100))
