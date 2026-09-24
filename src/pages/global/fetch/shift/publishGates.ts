/* eslint-disable @typescript-eslint/no-explicit-any */
// Гейты публикации при закрытии смены: какие черновики «условны» и публикуются
// только у СОСТОЯВШИХСЯ визитов (s197 — комиссии за дозаписи, s203 — списания за
// интерные услуги).
//
// 🟥 Общее правило: незакрытый, отменённый или удалённый визит смену НЕ блокирует.
// Такой черновик просто не публикуется и уходит в список `skipped` — владелец видит
// его отдельно и решает сам. Иначе одна незакрытая бронь не давала бы закрыть день.
//
// Вынесено из shiftClose.ts: тот перешагнул порог 600 строк из аудита (test-split).

import { internalPayrollState, isEnginePayrollItem } from '../../../../lib/internalPayroll'
import { upsellCommissionState } from '../../../../lib/upsellCommission'
import { COLLECTION_LABEL, buildLabel, type PublishFailure } from './validate'

const SKIP_REASON: Record<string, string> = {
  visit_open: 'návštěva ještě není uzavřená',
  visit_cancelled: 'návštěva zrušena / nedostavila se',
  no_booking: 'rezervace neexistuje',
}

/**
 * Отфильтровать черновики коллекции по состоянию связанной брони.
 * Отсеянные дописываются в `skipped` (мутирует переданный массив — как было в shiftClose).
 *
 * @param isOurs  какие записи вообще подпадают под гейт (остальные публикуются как раньше)
 * @param stateOf состояние по связанной брони: 'ready' → публикуем
 */
const gateBy = (
  items: any[],
  collectionKey: string,
  skipped: PublishFailure[],
  isOurs: (item: any) => boolean,
  stateOf: (item: any) => string,
): any[] =>
  (items || []).filter((item: any) => {
    if (!isOurs(item)) return true
    const state = stateOf(item)
    if (state === 'ready') return true
    skipped.push({
      collection: COLLECTION_LABEL[collectionKey],
      label: buildLabel(collectionKey, item),
      message: SKIP_REASON[state],
      documentId: item?.documentId,
    })
    return false
  })

/** Комиссии администраторов за дозаписи (add-money, source=upsell) — s197. */
export const gateUpsellCommissions = (items: any[], skipped: PublishFailure[]): any[] =>
  gateBy(items, 'add-moneys', skipped, () => true, upsellCommissionState)

/**
 * Списания движка: за интерные услуги (source=internal, s203) и за бесплатные
 * коррекции визитов прошлого месяца (source=korekce, s210).
 * Ручные `payroll` владельца (без `source`) гейт не трогает вовсе.
 */
export const gateInternalPayrolls = (items: any[], skipped: PublishFailure[]): any[] =>
  gateBy(items, 'payrolls', skipped, isEnginePayrollItem, internalPayrollState)
