// Обёртка таблиц в новом стиле (s165): БЕЗ собственной карточки — таблица живёт
// внутри белой карточки-секции (StatSection/карточка страницы), сама даёт только
// горизонтальный скролл + итоговую строку по макету.

interface TableWrapperProps {
  children: React.ReactNode
  totalSum?: string
  totalLabel?: string
  additionalInfo?: string
}

export const TableWrapper = ({ children, totalSum, totalLabel, additionalInfo }: TableWrapperProps) => {
  return (
    <div className={'w-full'}>
      <div className={'relative w-full overflow-x-auto'}>{children}</div>

      {totalSum && (
        <div className={'flex justify-between items-center pt-3 mt-1'}>
          <span className={'text-[13px] font-bold text-[#4c4844]'}>
            {totalLabel || 'Общая сумма'}
          </span>
          <span className={'text-[18px] font-extrabold text-[#b81b60] whitespace-nowrap'}>
            {totalSum}
          </span>
        </div>
      )}

      {additionalInfo && (
        <div className={'pt-2'}>
          <span className={'text-[12.5px] font-semibold text-[#a39e99]'}>{additionalInfo}</span>
        </div>
      )}
    </div>
  )
}
