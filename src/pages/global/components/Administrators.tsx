import type { IFilteredAdminsData } from '../../dashboard/fetch/allAdminsHours'

import { findCommonZeroKeys } from '../../../utils/findCommonZeroKeys'

import { Cell } from '../../dashboard/components/Cell'

import { TableWrapper } from './TableWrapper'

export const Administrators = ({
  data,
  sumAdmins,
}: {
  data: IFilteredAdminsData['summary']
  sumAdmins: number
}) => {
  const emptyKeys = new Set(findCommonZeroKeys(data))
  return (
    <TableWrapper totalSum={`${sumAdmins.toLocaleString()} Kč`} totalLabel={'Общая сумма'}>
      <table className={'w-full text-left table-auto min-w-max'}>
        <thead>
          <tr>
            <Cell title={'Имя'} asHeader />
            <Cell title={'Часов'} asHeader />
            <Cell title={'Зароботок'} asHeader />
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
            const result = item.sum * item.rate + item.extraProfit - item.penalty - item.payrolls
            const splitName = item.name.split(' ')
            return (
              <tr key={item.name} className={'hover:bg-gray-50 transition-colors'}>
                <Cell title={`${splitName[0][0]}. ${splitName[1]}`} />
                <Cell title={`${item.sum.toLocaleString()} hod`} />
                <Cell title={`${(item.sum * item.rate).toLocaleString()}`} />
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
