interface TableWrapperProps {
  children: React.ReactNode
  totalSum?: string
  totalLabel?: string
}

export const TableWrapper = ({ children, totalSum, totalLabel }: TableWrapperProps) => {
  return (
    <div className={'w-full'}>
      <div
        className={'relative flex flex-col w-full overflow-hidden bg-white shadow-md rounded-xl'}
      >
        <div className={'relative w-full overflow-x-auto'}>{children}</div>
      </div>

      {totalSum && (
        <div className={'flex justify-between items-center mt-3 p-3 rounded-lg'}>
          <span className={'text-sm md:text-base font-medium text-gray-700'}>
            {totalLabel || 'Общая сумма'}
          </span>
          <span
            className={'text-base md:text-md font-bold text-primary opacity-80 whitespace-nowrap'}
          >
            {totalSum}
          </span>
        </div>
      )}
    </div>
  )
}
