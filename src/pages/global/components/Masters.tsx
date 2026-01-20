import type { IFilteredData } from '../../dashboard/fetch/allWorks'

import { findCommonZeroKeys } from '../../../utils/findCommonZeroKeys'

import { Cell } from '../../dashboard/components/Cell'

import { TableWrapper } from './TableWrapper'

// Администраторы, которые также работают мастерами - их превышение считается в таблице администраторов
const ADMIN_MASTERS = ['Oleksandra Fishchuk']

export const Masters = ({
  data,
  sumMasters,
}: {
  data: IFilteredData['summary']
  sumMasters: number
}) => {
  const emptyKeys = new Set(findCommonZeroKeys(data))

  // Рассчитываем общую сумму превышений (исключая администраторов-мастеров)
  const totalExcess = data.reduce((sum, item) => {
    // Пропускаем администраторов-мастеров - их превышение в таблице администраторов
    if (ADMIN_MASTERS.includes(item.name)) return sum
    const result = item.sum + item.sumTip + item.extraProfit - item.penalty - item.payrolls
    const threshold = item.excessThreshold ?? 0
    const excess = result > threshold ? result - threshold : 0
    return sum + excess
  }, 0)

  return (
    <TableWrapper
      totalSum={`${sumMasters.toLocaleString()} Kč`}
      totalLabel={'Общая сумма'}
      additionalInfo={totalExcess > 0 ? `Общее превышение: ${totalExcess.toLocaleString()} Kč` : undefined}
    >
      <table className={'w-full text-left table-auto min-w-max'}>
        <thead>
          <tr>
            <Cell title={'Имя'} asHeader />
            <Cell title={'Кл.'} asHeader />
            <Cell title={'Зарб.'} asHeader />
            {!emptyKeys.has('sumTip') && <Cell title={'Чай'} asHeader />}
            {!emptyKeys.has('penalty') && <Cell title={'Штрафы'} asHeader />}
            {!emptyKeys.has('extraProfit') && <Cell title={'Доп.'} asHeader />}
            {!emptyKeys.has('payrolls') && <Cell title={'Спис.'} asHeader />}
            <Cell title={'Результат'} asHeader />
            <Cell title={'Превышение'} asHeader />
            {!emptyKeys.has('advance') && <Cell title={'Аванс'} asHeader />}
            {!emptyKeys.has('salaries') && <Cell title={'ЗП.'} asHeader />}
            {!emptyKeys.has('advance') && <Cell title={'Осталось'} asHeader />}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const isAdminMaster = ADMIN_MASTERS.includes(item.name)
            // Для администраторов-мастеров: результат = только заработок + чаевые (без штрафов/премий/списываний)
            const result = isAdminMaster
              ? item.sum + item.sumTip
              : item.sum + item.sumTip + item.extraProfit - item.penalty - item.payrolls
            const threshold = item.excessThreshold ?? 0
            // Для администраторов-мастеров превышение не показываем (оно в таблице администраторов)
            const excess = isAdminMaster ? 0 : (result > threshold ? result - threshold : 0)

            return (
              <tr key={item.name} className={'hover:bg-gray-50 transition-colors'}>
                <Cell title={item.name} />
                <Cell title={`${item.countClient}`} />
                <Cell title={`${item.sum.toLocaleString()}`} />
                {!emptyKeys.has('sumTip') && (
                  <Cell title={item.sumTip ? `${item.sumTip.toLocaleString()}` : ''} />
                )}
                {!emptyKeys.has('penalty') && (
                  <Cell title={isAdminMaster ? '' : (item.penalty ? `-${item.penalty.toLocaleString()}` : '')} />
                )}
                {!emptyKeys.has('extraProfit') && (
                  <Cell title={isAdminMaster ? '' : (item.extraProfit ? `${item.extraProfit.toLocaleString()}` : '')} />
                )}
                {!emptyKeys.has('payrolls') && (
                  <Cell title={isAdminMaster ? '' : (item.payrolls ? `-${item.payrolls.toLocaleString()}` : '')} />
                )}
                <Cell
                  className={'text-primary font-semibold'}
                  title={`${result.toLocaleString()}`}
                />
                <Cell
                  className={excess > 0 ? 'text-orange-600 font-semibold' : ''}
                  title={excess > 0 ? `+${excess.toLocaleString()}` : '-'}
                />
                {!emptyKeys.has('advance') && (
                  <Cell title={item.advance ? `-${item.advance.toLocaleString()}` : ''} />
                )}
                {!emptyKeys.has('salaries') && (
                  <Cell title={item.salaries ? `-${item.salaries.toLocaleString()}` : ''} />
                )}
                {(!emptyKeys.has('advance') || !emptyKeys.has('salaries')) && (
                  <Cell
                    className={'text-primary font-semibold'}
                    title={`${(result - item.advance - item.salaries).toLocaleString()}`}
                  />
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableWrapper>
  )
}
