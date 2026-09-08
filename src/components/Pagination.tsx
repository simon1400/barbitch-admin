import { btnNeutralCls, mutedCls } from '../ui/kit'

// Общая пагинация списков админки. Разметка взята из «Дублей клиентов» —
// она же образец в чеклисте аудита (этап 3.2).
//
// ⚠️ В `LoyaltyPage` и `ClientDuplicatesPage` до сих пор живут свои копии; их
// перевод сюда — пункт этапа 5 (дубли), там это заодно чуть меняет вид кнопок,
// поэтому отдельным шагом.

export function Pagination({
  page,
  total,
  pageSize,
  onPage,
  unit,
}: {
  page: number
  total: number
  pageSize: number
  onPage: (p: number) => void
  /** Слово после числа: «из 120 записей». По умолчанию — без слова. */
  unit?: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  if (pageCount <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className={'mt-4 flex items-center justify-between'}>
      <span className={mutedCls}>
        {from}–{to} из {total}
        {unit ? ` ${unit}` : ''}
      </span>
      <div className={'flex items-center gap-2'}>
        <button
          type={'button'}
          className={btnNeutralCls}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Назад
        </button>
        <span className={'text-[13px] font-semibold text-ink-muted'}>
          {page} / {pageCount}
        </span>
        <button
          type={'button'}
          className={btnNeutralCls}
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Дальше →
        </button>
      </div>
    </div>
  )
}
