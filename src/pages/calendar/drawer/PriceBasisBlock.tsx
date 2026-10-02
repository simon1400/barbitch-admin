// Выбор причины ручного занижения цены в форме «Uzavřít návštěvu» (s241).
// Вынесен из VisitCloseSection.tsx: тот у порога 600 строк из аудита.
//
// Показывается, только когда цена брони ниже каталожной (hint.manualBasis). Выбор
// обязателен и по умолчанию пуст: от него зависит, от какой цены мастеру считается
// процент, — подсказки сумм появляются после выбора.

import type { VisitCheckoutHint } from '../fetch/engineApi'
import { kc2 } from '../../../utils/money'
import type { BasisChoice } from './priceBasis'

const optionCls = 'flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-300'

export const PriceBasisBlock = ({
  hint,
  value,
  onChange,
}: {
  hint: VisitCheckoutHint
  value: BasisChoice
  onChange: (v: BasisChoice) => void
}) => {
  if (!hint.manualBasis) return null
  return (
    <div
      className="mb-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 dark:border-orange-500/40 dark:bg-orange-500/10"
      data-basis-block
    >
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-orange-800 dark:text-orange-200">
        Důvod ruční ceny *
      </div>
      <label className={optionCls}>
        <input
          type="radio"
          name="price-basis"
          value="catalog"
          checked={value === 'catalog'}
          onChange={() => onChange('catalog')}
          className="mt-1 accent-primary"
        />
        <span>
          <b>Sleva</b> — mistr dostane podíl z ceníkové ceny ({kc2(hint.fullPrice)})
        </span>
      </label>
      <label className={`${optionCls} mt-1`}>
        <input
          type="radio"
          name="price-basis"
          value="paid"
          checked={value === 'paid'}
          onChange={() => onChange('paid')}
          className="mt-1 accent-primary"
        />
        <span>
          <b>Menší rozsah práce</b> — mistr dostane podíl ze zaplacené ceny ({kc2(hint.manualBasis.fullPrice)})
        </span>
      </label>
      {!value && (
        <div className="mt-1 text-[12px] text-orange-800 dark:text-orange-200" data-basis-missing>
          Podle důvodu se spočítá podíl mistra a salonu.
        </div>
      )}
    </div>
  )
}
