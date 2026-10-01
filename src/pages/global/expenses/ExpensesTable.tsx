import { fmtCsDate } from '../../../utils/date'
import { kc, kcNum } from '../../../utils/money'
import { badgeMutedCls, badgeWarnCls, mutedCls } from '../../../ui/kit'
import { Cell } from '../../dashboard/components/Cell'
import { TableWrapper } from '../components/TableWrapper'
import { PAYMENT_LABELS, REQUEST_LABELS, type CostRow } from '../fetch/expenses'

// Таблица затрат месяца. Клик по строке открывает форму (правка у владельца,
// запрос у управляющей). Строка с ожидающим запросом помечена — деньги в итогах
// старые, пока владелец не одобрит.
export function ExpensesTable({
  rows,
  selectedId,
  onOpen,
}: {
  rows: CostRow[]
  selectedId: string | null
  onOpen: (row: CostRow) => void
}) {
  const totalSum = rows.reduce((s, r) => s + r.sum, 0)
  const totalNoDph = rows.reduce((s, r) => s + r.noDph, 0)

  return (
    <TableWrapper
      totalSum={`Всего: ${kc(totalSum)}`}
      totalLabel={'Общая сумма'}
      additionalInfo={`Без DPH: ${kcNum(totalNoDph)} Kč`}
    >
      <table className={'w-full text-left min-w-[920px]'}>
        <thead>
          <tr>
            <Cell title={'Дата'} asHeader />
            <Cell title={'Название'} asHeader />
            <Cell title={'Категория'} asHeader />
            <Cell title={'Оплата'} asHeader />
            <Cell title={'Сумма'} asHeader className={'text-right'} />
            <Cell title={'Без DPH'} asHeader className={'text-right'} />
            <Cell title={'Внёс'} asHeader />
            <Cell title={'Чек'} asHeader className={'text-center'} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.documentId}
              data-row={r.documentId}
              tabIndex={0}
              aria-selected={selectedId === r.documentId}
              className={`cursor-pointer transition-colors hover:bg-surface-hover ${
                selectedId === r.documentId ? 'bg-surface-hover' : ''
              }`}
              onClick={() => onOpen(r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onOpen(r)
              }}
            >
              <Cell title={fmtCsDate(r.date)} className={'whitespace-nowrap'} />
              <td className={'px-3 py-[10px] border-b border-line-soft'}>
                <div className={'text-[14px] font-bold text-ink'}>{r.name}</div>
                {r.comment && <div className={`${mutedCls} mt-0.5`}>{r.comment}</div>}
                {r.pendingRequest && (
                  <span className={`${badgeWarnCls} mt-1 inline-block`} data-pending={r.pendingRequest.action}>
                    ждёт одобрения: {REQUEST_LABELS[r.pendingRequest.action]}
                  </span>
                )}
              </td>
              <Cell title={r.category} className={'text-[13px]'} />
              <Cell title={r.payment ? PAYMENT_LABELS[r.payment] ?? r.payment : '—'} className={'text-[13px]'} />
              <Cell
                title={kc(r.sum)}
                className={'text-right whitespace-nowrap text-[14px] font-extrabold text-brand-dark'}
              />
              <Cell
                title={r.vat === 0 ? '—' : kc(r.noDph)}
                className={'text-right whitespace-nowrap text-ink-soft'}
              />
              <td className={'px-3 py-[10px] border-b border-line-soft'}>
                {r.viaPanel ? (
                  <span className={badgeMutedCls} title={'Внесено в панели Strapi'}>
                    панель
                  </span>
                ) : (
                  <span className={'text-[13px] font-semibold text-ink-body'}>{r.author}</span>
                )}
              </td>
              <td className={'px-3 py-[10px] border-b border-line-soft text-center whitespace-nowrap'} data-files={r.files.length}>
                {r.files.length > 0 ? (
                  <span title={r.files.map((f) => f.fileName).join(', ')}>📎{r.files.length > 1 ? ` ${r.files.length}` : ''}</span>
                ) : (
                  <span className={'text-ink-faint'}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrapper>
  )
}
