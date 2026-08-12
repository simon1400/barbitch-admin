import type { IFilteredData } from '../../dashboard/fetch/allWorks'

import { findCommonZeroKeys } from '../../../utils/findCommonZeroKeys'
import { NAME_CELL, NEG_CELL, NUM_CELL, RESULT_CELL } from '../../../ui/kit'

import { Cell } from '../../dashboard/components/Cell'

import { TableWrapper } from './TableWrapper'

export const Masters = ({
  data,
  sumMasters,
}: {
  data: IFilteredData['summary']
  sumMasters: number
}) => {
  const emptyKeys = new Set(findCommonZeroKeys(data))

  // Проверяем, есть ли авансы или зарплаты у кого-либо
  const hasAdvanceOrSalary = !emptyKeys.has('advance') || !emptyKeys.has('salaries')

  // Рассчитываем общую сумму превышений
  const totalExcess = data.reduce((sum, item) => {
    const result = item.sum + item.sumTip + item.extraProfit - item.penalty - item.payrolls
    const remaining = result - item.advance - item.salaries
    const threshold = item.excessThreshold ?? 0
    // Считаем от остатка если есть авансы/зарплаты, иначе от результата
    const baseForExcess = hasAdvanceOrSalary ? remaining : result
    const excess = baseForExcess > threshold ? baseForExcess - threshold : 0
    return sum + excess
  }, 0)

  return (
    <TableWrapper
      totalSum={`${sumMasters.toLocaleString()} Kč`}
      totalLabel={'Общая сумма'}
      additionalInfo={totalExcess > 0 ? `Общее превышение: ${totalExcess.toLocaleString()} Kč` : undefined}
    >
      <table className={'w-full text-left min-w-[720px]'}>
        <thead>
          <tr>
            <Cell title={'Имя'} asHeader />
            <Cell title={'Кл.'} asHeader className={'text-right'} />
            <Cell title={'Зарб.'} asHeader className={'text-right'} />
            {!emptyKeys.has('sumTip') && <Cell title={'Чай'} asHeader className={'text-right'} />}
            {!emptyKeys.has('penalty') && <Cell title={'Штр.'} asHeader className={'text-right'} />}
            {!emptyKeys.has('extraProfit') && <Cell title={'Доп.'} asHeader className={'text-right'} />}
            {!emptyKeys.has('payrolls') && <Cell title={'Спис.'} asHeader className={'text-right'} />}
            <Cell title={'Результат'} asHeader className={'text-right'} />

            {!emptyKeys.has('advance') && <Cell title={'Аванс'} asHeader className={'text-right'} />}
            {!emptyKeys.has('salaries') && <Cell title={'ЗП.'} asHeader className={'text-right'} />}
            {totalExcess > 0 && <Cell title={'Превышение'} asHeader className={'text-right'} />}
            {(!emptyKeys.has('advance') || !emptyKeys.has('salaries')) && (
              <Cell title={'Осталось'} asHeader className={'text-right'} />
            )}
            {!emptyKeys.has('taxes') && <Cell title={'Налоги'} asHeader className={'text-right'} />}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const result = item.sum + item.sumTip + item.extraProfit - item.penalty - item.payrolls
            const remaining = result - item.advance - item.salaries
            const threshold = item.excessThreshold ?? 0
            // Считаем превышение от остатка если есть авансы/зарплаты, иначе от результата
            const baseForExcess = hasAdvanceOrSalary ? remaining : result
            const excess = baseForExcess > threshold ? baseForExcess - threshold : 0
            const splitName = item.name.split(' ')

            return (
              <tr key={item.name} className={'hover:bg-surface-hover transition-colors'}>
                <Cell
                  title={`${splitName[0][0]}. ${splitName[1]}`}
                  className={NAME_CELL}
                  onClick={() => navigator.clipboard.writeText(item.name)}
                />
                <Cell title={`${item.countClient}`} className={NUM_CELL} />
                <Cell title={`${item.sum.toLocaleString()}`} className={NUM_CELL} />
                {!emptyKeys.has('sumTip') && (
                  <Cell
                    title={item.sumTip ? `${item.sumTip.toLocaleString()}` : ''}
                    className={NUM_CELL}
                  />
                )}
                {!emptyKeys.has('penalty') && (
                  <Cell
                    title={item.penalty ? `-${item.penalty.toLocaleString()}` : ''}
                    className={NEG_CELL}
                  />
                )}
                {!emptyKeys.has('extraProfit') && (
                  <Cell
                    title={item.extraProfit ? `${item.extraProfit.toLocaleString()}` : ''}
                    className={NUM_CELL}
                  />
                )}
                {!emptyKeys.has('payrolls') && (
                  <Cell
                    title={item.payrolls ? `-${item.payrolls.toLocaleString()}` : ''}
                    className={NEG_CELL}
                  />
                )}
                <Cell className={RESULT_CELL} title={`${result.toLocaleString()}`} />

                {!emptyKeys.has('advance') && (
                  <Cell
                    title={item.advance ? `-${item.advance.toLocaleString()}` : ''}
                    className={NEG_CELL}
                  />
                )}
                {!emptyKeys.has('salaries') && (
                  <Cell
                    title={item.salaries ? `-${item.salaries.toLocaleString()}` : ''}
                    className={NEG_CELL}
                  />
                )}
                {totalExcess > 0 && (
                  <Cell
                    className={excess > 0 ? `${NUM_CELL} text-warn font-bold` : NUM_CELL}
                    title={excess > 0 ? `+${excess.toLocaleString()}` : '-'}
                  />
                )}
                {(!emptyKeys.has('advance') || !emptyKeys.has('salaries')) && (
                  <Cell className={RESULT_CELL} title={`${remaining.toLocaleString()}`} />
                )}
                {!emptyKeys.has('taxes') && (
                  <Cell
                    title={item.taxes ? `${item.taxes.toLocaleString()}` : ''}
                    className={NUM_CELL}
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
