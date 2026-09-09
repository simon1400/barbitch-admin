// Плитки результата расчёта. Перенесено из TaxesTab.tsx (этап 6) дословно.
import type { EmployeeTaxResult } from '../../fetch/czechTax'
import { kc } from '../../../../../utils/money'
import { tileLabCls } from './styles'

// Ячейка результата: подпись сверху, сумма снизу. Сетка из таких ячеек
// заменяет широкие колонки таблицы — на телефоне складывается в 2 колонки.
// plain — без плитки-подложки (для блока «Итого», он сам на surface-tile).
function StatBox({
  label,
  value,
  tone = 'text-ink-body',
  plain,
}: {
  label: string
  value: string
  tone?: string
  plain?: boolean
}) {
  return (
    <div className={plain ? '' : 'bg-surface-tile rounded-lg px-3 py-2.5'}>
      <div className={`${tileLabCls} mb-1`}>{label}</div>
      <div className={`text-[15px] font-extrabold leading-snug ${tone}`}>{value}</div>
    </div>
  )
}

// Главный ответ на вопрос «сколько я заплатил за человека сверх того, что он
// получил на руки». Инвариант: odvodyTotal = náklad firmy − čistá.
// ⚠️ Старый токен primary с alpha не рендерится (он = var(--primary), без alpha-канала).
// У новых токенов палитры (brand и др.) суффикс прозрачности работает штатно.
export function OdvodyBox({
  res,
  totalLabel = 'Odvody celkem — mimo čistou mzdu',
}: {
  res: Pick<EmployeeTaxResult, 'odvodyTotal' | 'employerShare' | 'employeeShare'>
  totalLabel?: string
}) {
  if (!res.odvodyTotal) return null

  return (
    <div className="mt-3 bg-brand-tint border border-brand-line rounded-lg px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className={`${tileLabCls} text-brand-dark`}>{totalLabel}</span>
        <span className="text-[19px] font-extrabold text-brand-dark leading-none">
          {kc(res.odvodyTotal)}
        </span>
      </div>
      <div className="mt-1.5 text-[12px] font-medium text-ink-soft">
        z toho platí salon navíc <b className="text-brand-dark">{kc(res.employerShare)}</b> · sráženo
        ze mzdy zaměstnance <b className="text-brand-dark">{kc(res.employeeShare)}</b>
      </div>
    </div>
  )
}

export function ResultGrid({
  gross,
  health,
  social,
  tax,
  cost,
  plain,
}: {
  gross: number
  health: number
  social: number
  tax: number
  cost: number
  plain?: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <StatBox label="Hrubá mzda" value={gross ? kc(gross) : '—'} plain={plain} />
      <StatBox
        label="Zdravotní"
        value={health ? kc(health) : '—'}
        tone="text-info"
        plain={plain}
      />
      <StatBox
        label="Sociální"
        value={social ? kc(social) : '—'}
        tone="text-warn"
        plain={plain}
      />
      <StatBox label="Daň (FÚ)" value={tax ? kc(tax) : '—'} tone="text-neg" plain={plain} />
      <StatBox
        label="Náklad firmy"
        value={cost ? kc(cost) : '—'}
        tone="text-brand-dark"
        plain={plain}
      />
    </div>
  )
}
