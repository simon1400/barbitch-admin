// Причина ручного занижения цены в форме «Uzavřít návštěvu» (s241).
//
// Жалоба владельца 02.10.2026: «Sundání řas + Intenzivní regenerace» 490 Kč по
// каталогу, цена брони руками 190 — подсказка «мастеру 196, салону −6». Правило s203
// (мастер всегда от каталожной цены) верно для скидки, но не когда сделана меньшая
// работа. Причину выбирает админ; сервер хранит её в service-provided.priceBasis и
// считает флаги сам — здесь только живая подсказка.

import type { VisitCheckoutHint } from '../fetch/engineApi'
import type { PriceBasis } from '../../../lib/verifyFlags'

export type BasisChoice = '' | PriceBasis

/**
 * Подсказка под выбранную причину: 'paid' → база процента и доля мастера от цены
 * брони (салон и ручную скидку форма досчитывает от них же, как от каталожных).
 */
export const hintForBasis = (hint: VisitCheckoutHint, basis: BasisChoice): VisitCheckoutHint =>
  basis === 'paid' && hint.manualBasis
    ? { ...hint, fullPrice: hint.manualBasis.fullPrice, mustStaff: hint.manualBasis.mustStaff }
    : hint
