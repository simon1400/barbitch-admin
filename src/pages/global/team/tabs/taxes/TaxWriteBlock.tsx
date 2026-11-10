// Блок «Записать налоги в корректировки» внутри карточки сотрудника (s285).
// 🟥 Обёртка `data-testid="tax-write"` + концевая метка: стенд test-split вырезает
// блок из побайтового снимка карточки (он новый, в закреплённой версии его нет).
import { Link } from 'react-router-dom'
import { badgePosCls, btnNeutralCls, btnPinkCls, hintCls } from '../../../../../ui/kit'
import { kc } from '../../../../../utils/money'
import { TAX_TYPE_LABELS, periodLabel, type CorrectionRow } from '../../fetch/corrections'
import type { TaxEntry } from './writeTaxes'

export function TaxWriteBlock({
  personDocId,
  entries,
  existing,
  period,
  busy,
  onWrite,
}: {
  /** карточка сотрудника из списка; null — имя не из списка, писать некуда */
  personDocId: string | null
  entries: TaxEntry[]
  /** налоги за этот месяц, уже записанные за сотрудника */
  existing: CorrectionRow[]
  period: string
  busy: boolean
  onWrite: () => void
}) {
  const canWrite = !!personDocId && entries.length > 0 && !busy
  const written = existing.reduce((a, r) => a + r.sum, 0)
  return (
    <div data-testid="tax-write" className="mt-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        {existing.length > 0 ? (
          <div className="text-[12.5px] font-semibold text-ink-soft" data-tax-written={existing.length}>
            <span className={`${badgePosCls} mr-1.5`}>записано {periodLabel(period)}</span>
            {existing.map((r) => `${TAX_TYPE_LABELS[r.taxType ?? 'all']} ${kc(r.sum)}`).join(' · ')} ={' '}
            <b className="text-ink">{kc(written)}</b> ·{' '}
            <Link to="/global/team/corrections" className="underline text-brand-dark">
              корректировки
            </Link>
          </div>
        ) : (
          <span className={hintCls}>
            {!personDocId
              ? 'Чтобы записать налоги, выберите сотрудника из списка.'
              : entries.length === 0
                ? 'Налогов к записи нет (нули).'
                : `Запишет в «Корректировки» ${periodLabel(period)}, датой сегодня: ${entries
                    .map((e) => `${e.label} ${kc(e.sum)}`)
                    .join(' · ')}.`}
          </span>
        )}
      </div>
      <button
        type="button"
        className={existing.length > 0 ? btnNeutralCls : btnPinkCls}
        disabled={!canWrite}
        onClick={onWrite}
        data-tax-write-btn={personDocId ?? ''}
      >
        {busy ? 'Записываю…' : existing.length > 0 ? 'Записать ещё раз' : 'Записать налоги'}
      </button>
      <span data-tax-write-end="true"></span>
    </div>
  )
}
