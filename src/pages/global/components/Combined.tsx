import type { CombinedResult } from '../../dashboard/fetch/teamSplit'

import { findCommonZeroKeys } from '../../../utils/findCommonZeroKeys'

import { Cell } from '../../dashboard/components/Cell'

import { TableWrapper } from './TableWrapper'

// Таблица «Совместители» — сотрудники, работающие И мастером, И администратором.
// Всё считается в одной строке: часы как администратор + заработок с клиентов + чай +
// штрафы/списывания/налоги. Логика результата/остатка/превышения — как в Masters/Administrators.
export const Combined = ({
  data,
  sumCombined,
}: {
  data: CombinedResult[]
  sumCombined: number
}) => {
  const emptyKeys = new Set(findCommonZeroKeys(data))

  const hasAdvanceOrSalary = !emptyKeys.has('advance') || !emptyKeys.has('salaries')

  // Результат строки = заработок с клиентов + чай + админ-часы + доп - штрафы - списывания
  const rowResult = (item: CombinedResult) =>
    item.sum + item.sumTip + item.adminEarnings + item.extraProfit - item.penalty - item.payrolls

  const totalExcess = data.reduce((sum, item) => {
    const result = rowResult(item)
    const remaining = result - item.advance - item.salaries
    const threshold = item.excessThreshold ?? 0
    const baseForExcess = hasAdvanceOrSalary ? remaining : result
    const excess = baseForExcess > threshold ? baseForExcess - threshold : 0
    return sum + excess
  }, 0)

  return (
    <TableWrapper
      totalSum={`${sumCombined.toLocaleString()} Kč`}
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
            <Cell title={'Часов'} asHeader />
            <Cell title={'Админ'} asHeader />
            {!emptyKeys.has('penalty') && <Cell title={'Штр.'} asHeader />}
            {!emptyKeys.has('extraProfit') && <Cell title={'Доп.'} asHeader />}
            {!emptyKeys.has('payrolls') && <Cell title={'Спис.'} asHeader />}
            <Cell title={'Результат'} asHeader />
            {!emptyKeys.has('advance') && <Cell title={'Аванс'} asHeader />}
            {!emptyKeys.has('salaries') && <Cell title={'ЗП.'} asHeader />}
            {totalExcess > 0 && <Cell title={'Превышение'} asHeader />}
            {(!emptyKeys.has('advance') || !emptyKeys.has('salaries')) && <Cell title={'Осталось'} asHeader />}
            {!emptyKeys.has('taxes') && <Cell title={'Налоги'} asHeader />}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const result = rowResult(item)
            const remaining = result - item.advance - item.salaries
            const threshold = item.excessThreshold ?? 0
            const baseForExcess = hasAdvanceOrSalary ? remaining : result
            const excess = baseForExcess > threshold ? baseForExcess - threshold : 0
            const splitName = item.name.split(' ')

            return (
              <tr key={item.name} className={'hover:bg-gray-50 transition-colors'}>
                <Cell
                  title={`${splitName[0][0]}. ${splitName[1]}`}
                  className="cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(item.name)}
                />
                <Cell title={`${item.countClient}`} />
                <Cell title={`${item.sum.toLocaleString()}`} />
                {!emptyKeys.has('sumTip') && (
                  <Cell title={item.sumTip ? `${item.sumTip.toLocaleString()}` : ''} />
                )}
                <Cell title={`${item.hours.toLocaleString()} hod`} />
                <Cell title={`${item.adminEarnings.toLocaleString()}`} />
                {!emptyKeys.has('penalty') && (
                  <Cell title={item.penalty ? `-${item.penalty.toLocaleString()}` : ''} />
                )}
                {!emptyKeys.has('extraProfit') && (
                  <Cell title={item.extraProfit ? `${item.extraProfit.toLocaleString()}` : ''} />
                )}
                {!emptyKeys.has('payrolls') && (
                  <Cell title={item.payrolls ? `-${item.payrolls.toLocaleString()}` : ''} />
                )}
                <Cell
                  className={'text-primary font-semibold'}
                  title={`${result.toLocaleString()}`}
                />
                {!emptyKeys.has('advance') && (
                  <Cell title={item.advance ? `-${item.advance.toLocaleString()}` : ''} />
                )}
                {!emptyKeys.has('salaries') && (
                  <Cell title={item.salaries ? `-${item.salaries.toLocaleString()}` : ''} />
                )}
                {totalExcess > 0 && (
                  <Cell
                    className={excess > 0 ? 'text-orange-600 font-semibold' : ''}
                    title={excess > 0 ? `+${excess.toLocaleString()}` : '-'}
                  />
                )}
                {(!emptyKeys.has('advance') || !emptyKeys.has('salaries')) && (
                  <Cell
                    className={'text-primary font-semibold'}
                    title={`${remaining.toLocaleString()}`}
                  />
                )}
                {!emptyKeys.has('taxes') && (
                  <Cell title={item.taxes ? `${item.taxes.toLocaleString()}` : ''} />
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableWrapper>
  )
}
