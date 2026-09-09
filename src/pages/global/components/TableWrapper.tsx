// Обёртка таблиц в новом стиле (s165): БЕЗ собственной карточки — таблица живёт
// внутри белой карточки-секции (StatSection/карточка страницы), сама даёт только
// горизонтальный скролл + итоговую строку по макету.

import { bodyBoldCls, mutedCls, totalRowCls, totalValueCls } from '../../../ui/kit'

interface TableWrapperProps {
  children: React.ReactNode
  totalSum?: string
  totalLabel?: string
  additionalInfo?: string
}

export const TableWrapper = ({ children, totalSum, totalLabel, additionalInfo }: TableWrapperProps) => {
  return (
    <div className={'w-full'}>
      {/* Крайние колонки без внешних отступов — таблица прижата к краям карточки */}
      <div
        className={
          'relative w-full overflow-x-auto [&_tr>*:first-child]:pl-0 [&_tr>*:last-child]:pr-0'
        }
      >
        {children}
      </div>

      {totalSum && (
        <div className={totalRowCls}>
          <span className={bodyBoldCls}>
            {totalLabel || 'Общая сумма'}
          </span>
          <span className={totalValueCls}>
            {totalSum}
          </span>
        </div>
      )}

      {additionalInfo && (
        <div className={'pt-2'}>
          <span className={mutedCls}>{additionalInfo}</span>
        </div>
      )}
    </div>
  )
}
