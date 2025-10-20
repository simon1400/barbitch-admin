import { Cell } from '../../dashboard/components/Cell'

import { TableWrapper } from './TableWrapper'

export const Summary = ({
  income,
  salary,
  salaryAdmin,
  costs,
  cash,
  card,
  voucherPayed,
  qrMoney,
}: {
  income: number
  salary: number
  salaryAdmin: number
  costs: number
  cash: number
  card: number
  voucherPayed: number
  qrMoney: number
}) => {
  const result = card + cash + voucherPayed - salary - salaryAdmin - costs + qrMoney
  const resultColor = result >= 0 ? 'text-green-600' : 'text-red-600'

  return (
    <TableWrapper>
      <table className={'w-full text-left table-auto min-w-max'}>
        <thead>
          <tr>
            <Cell title={'Дох. усл.'} asHeader />
            <Cell title={'Карта и кеш'} asHeader />
            {!!voucherPayed && <Cell title={'Воуч. куп.'} asHeader />}
            <Cell title={'Мастерам'} asHeader />
            <Cell title={'Админам'} asHeader />
            <Cell title={'Затраты'} asHeader />
            {!!qrMoney && <Cell title={'QR'} asHeader />}
            <Cell title={'Результат'} asHeader />
          </tr>
        </thead>
        <tbody>
          <tr className={'hover:bg-gray-50 transition-colors'}>
            <Cell title={`+ ${income.toLocaleString()}`} />
            <Cell title={`+ ${(card + cash).toLocaleString()}`} />
            {!!voucherPayed && <Cell title={`+ ${voucherPayed.toLocaleString()}`} />}
            <Cell title={`-${salary.toLocaleString()}`} />
            <Cell title={`-${salaryAdmin.toLocaleString()}`} />
            <Cell title={`-${costs.toLocaleString()}`} />
            {!!qrMoney && <Cell title={`+ ${qrMoney.toLocaleString()}`} />}
            <Cell
              className={`font-semibold ${resultColor}`}
              title={`= ${result.toLocaleString('cz-CZ', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            />
          </tr>
        </tbody>
      </table>
    </TableWrapper>
  )
}
