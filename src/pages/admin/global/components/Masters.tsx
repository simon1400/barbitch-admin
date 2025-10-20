import type { IFilteredData } from '../../fetch/allWorks'

import { findCommonZeroKeys } from '../../../../utils/findCommonZeroKeys'

import { Cell } from '../../components/Cell'

import { TableWrapper } from './TableWrapper'

export const Masters = ({
  data,
  sumMasters,
}: {
  data: IFilteredData['summary']
  sumMasters: number
}) => {
  const emptyKeys = new Set(findCommonZeroKeys(data))
  return (
    <TableWrapper totalSum={`${sumMasters.toLocaleString()} Kč`} totalLabel={'Общая сумма'}>
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
            {!emptyKeys.has('advance') && <Cell title={'Аванс'} asHeader />}
            {!emptyKeys.has('salaries') && <Cell title={'ЗП.'} asHeader />}
            {!emptyKeys.has('advance') && <Cell title={'Осталось'} asHeader />}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const result = item.sum + item.sumTip + item.extraProfit - item.penalty - item.payrolls
            return (
              <tr key={item.name} className={'hover:bg-gray-50 transition-colors'}>
                <Cell title={item.name} />
                <Cell title={`${item.countClient}`} />
                <Cell title={`${item.sum.toLocaleString()}`} />
                {!emptyKeys.has('sumTip') && (
                  <Cell title={item.sumTip ? `${item.sumTip.toLocaleString()}` : ''} />
                )}
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
