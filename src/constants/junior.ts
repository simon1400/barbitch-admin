// Глобальная константа скидки для junior-мастеров.
// Применяется к ИТОГОВОЙ цене (-20% на всё, включая базу + варианты + modifiers).
// При изменении — синхронизировать с client/src/constants/junior.ts и пересоздать junior event_types в Noona.
export const JUNIOR_DISCOUNT_PERCENT = 20

export const calcJuniorPrice = (seniorPrice: number): number =>
  Math.round(seniorPrice * (1 - JUNIOR_DISCOUNT_PERCENT / 100))

// Junior-мастер выполняет услугу ДОЛЬШЕ senior'а. Наценка по времени применяется
// автоматически (как −20% к цене), результат округляется до 5 минут.
// junior-длительность = senior-длительность × (1 + markup%), напр. 55 → 85 мин при +50%.
export const JUNIOR_DURATION_MARKUP_PERCENT = 50

export const calcJuniorDuration = (seniorDuration: number): number =>
  Math.round((seniorDuration * (1 + JUNIOR_DURATION_MARKUP_PERCENT / 100)) / 5) * 5
