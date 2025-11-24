import { Cell } from '../../dashboard/components/Cell'

import { TableWrapper } from './TableWrapper'

export const Compare = ({
  income,
  cash,
  card,
  cardExtraIncome,
  payroll,
  voucherRealized,
  qrMoney,
}: {
  income: number
  cash: number
  card: number
  cardExtraIncome: number
  payroll: number
  voucherRealized: number
  qrMoney: number
}) => {
  const difference = card + cash + payroll + voucherRealized + qrMoney + cardExtraIncome - income
  const differenceColor = difference >= 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div className={'mb-6'}>
      <TableWrapper>
        <table className={'w-full text-left table-auto min-w-max'}>
          <thead>
            <tr>
              <Cell title={'Карта'} asHeader />
              {!!cardExtraIncome && <Cell title={'Доп. доход'} asHeader />}
              <Cell title={'Нал'} asHeader />
              {!!payroll && <Cell title={'Списывание'} asHeader />}
              <Cell title={'Сумма реал'} asHeader />
              <Cell title={'Доход адм'} asHeader />
              {!!voucherRealized && <Cell title={'Воуч. рлз.'} asHeader />}
              {!!qrMoney && <Cell title={'QR'} asHeader />}
              <Cell title={'Разница'} asHeader />
            </tr>
          </thead>
          <tbody>
            <tr className={'hover:bg-gray-50 transition-colors'}>
              <Cell title={`+${card.toLocaleString()}`} />
              {!!cardExtraIncome && <Cell title={`+${cardExtraIncome.toLocaleString()}`} />}
              <Cell title={`+${cash.toLocaleString()}`} />
              {!!payroll && <Cell title={`+${payroll.toLocaleString()}`} />}
              <Cell title={`=${(card + cardExtraIncome + cash + payroll).toLocaleString()}`} />
              <Cell title={`- ${income.toLocaleString()}`} />
              {!!voucherRealized && <Cell title={`+${voucherRealized.toLocaleString()}`} />}
              {!!qrMoney && <Cell title={`+${qrMoney.toLocaleString()}`} />}
              <Cell
                className={`font-semibold ${differenceColor}`}
                title={`= ${difference.toLocaleString()}`}
              />
            </tr>
          </tbody>
        </table>
      </TableWrapper>
    </div>
  )
}
