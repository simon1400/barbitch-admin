import { kcNum } from '../../../utils/money'
import { managerRowResult, type ManagerResult } from '../../dashboard/fetch/teamSplit'

import { findCommonZeroKeys } from '../../../utils/findCommonZeroKeys'
import { NAME_CELL, NEG_CELL, NUM_CELL, RESULT_CELL } from '../../../ui/kit'

import { Cell } from '../../dashboard/components/Cell'

import { TableWrapper } from './TableWrapper'

// Таблица «Управляющие» (s213): фиксированный оклад за месяц + обычные корректировки.
// Строка есть всегда, даже без активности. Услуги как мастер — в порядке исключения
// (обычно их нет: бронь ставится на другого мастера, деньги переносятся корректировками).
export const Managers = ({ data, sumManagers }: { data: ManagerResult[]; sumManagers: number }) => {
  const emptyKeys = new Set(findCommonZeroKeys(data))
  const hasRemaining = !emptyKeys.has('advance') || !emptyKeys.has('salaries')

  return (
    <TableWrapper totalSum={`${kcNum(sumManagers)} Kč`} totalLabel={'Общая сумма'}>
      <table className={'w-full text-left min-w-[640px]'}>
        <thead>
          <tr>
            <Cell title={'Имя'} asHeader />
            <Cell title={'Оклад'} asHeader className={NUM_CELL} />
            {!emptyKeys.has('countClient') && <Cell title={'Кл.'} asHeader className={NUM_CELL} />}
            {!emptyKeys.has('sum') && <Cell title={'Зарб.'} asHeader className={NUM_CELL} />}
            {!emptyKeys.has('sumTip') && <Cell title={'Чай'} asHeader className={NUM_CELL} />}
            {!emptyKeys.has('adminEarnings') && <Cell title={'Админ'} asHeader className={NUM_CELL} />}
            {!emptyKeys.has('penalty') && <Cell title={'Штр.'} asHeader className={NUM_CELL} />}
            {!emptyKeys.has('extraProfit') && <Cell title={'Доп.'} asHeader className={NUM_CELL} />}
            {!emptyKeys.has('payrolls') && <Cell title={'Спис.'} asHeader className={NUM_CELL} />}
            <Cell title={'Результат'} asHeader className={NUM_CELL} />
            {!emptyKeys.has('advance') && <Cell title={'Аванс'} asHeader className={NUM_CELL} />}
            {!emptyKeys.has('salaries') && <Cell title={'ЗП.'} asHeader className={NUM_CELL} />}
            {hasRemaining && <Cell title={'Осталось'} asHeader className={NUM_CELL} />}
            {!emptyKeys.has('taxes') && <Cell title={'Налоги'} asHeader className={NUM_CELL} />}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const result = managerRowResult(item)
            const remaining = result - item.advance - item.salaries
            const splitName = item.name.split(' ')

            return (
              <tr key={item.name} className={'hover:bg-surface-hover transition-colors'}>
                <Cell
                  title={splitName.length > 1 ? `${splitName[0][0]}. ${splitName[1]}` : item.name}
                  className={NAME_CELL}
                  onClick={() => navigator.clipboard.writeText(item.name)}
                />
                <Cell
                  title={item.fixedMissing ? 'не задан' : `${kcNum(item.fixed)}`}
                  className={item.fixedMissing ? `${NUM_CELL} text-warn font-bold` : NUM_CELL}
                />
                {!emptyKeys.has('countClient') && <Cell title={`${item.countClient}`} className={NUM_CELL} />}
                {!emptyKeys.has('sum') && <Cell title={item.sum ? `${kcNum(item.sum)}` : ''} className={NUM_CELL} />}
                {!emptyKeys.has('sumTip') && (
                  <Cell title={item.sumTip ? `${kcNum(item.sumTip)}` : ''} className={NUM_CELL} />
                )}
                {!emptyKeys.has('adminEarnings') && (
                  <Cell title={item.adminEarnings ? `${kcNum(item.adminEarnings)}` : ''} className={NUM_CELL} />
                )}
                {!emptyKeys.has('penalty') && (
                  <Cell title={item.penalty ? `-${kcNum(item.penalty)}` : ''} className={NEG_CELL} />
                )}
                {!emptyKeys.has('extraProfit') && (
                  <Cell title={item.extraProfit ? `${kcNum(item.extraProfit)}` : ''} className={NUM_CELL} />
                )}
                {!emptyKeys.has('payrolls') && (
                  <Cell title={item.payrolls ? `-${kcNum(item.payrolls)}` : ''} className={NEG_CELL} />
                )}
                <Cell className={RESULT_CELL} title={`${kcNum(result)}`} />
                {!emptyKeys.has('advance') && (
                  <Cell title={item.advance ? `-${kcNum(item.advance)}` : ''} className={NEG_CELL} />
                )}
                {!emptyKeys.has('salaries') && (
                  <Cell title={item.salaries ? `-${kcNum(item.salaries)}` : ''} className={NEG_CELL} />
                )}
                {hasRemaining && <Cell className={RESULT_CELL} title={`${kcNum(remaining)}`} />}
                {!emptyKeys.has('taxes') && (
                  <Cell title={item.taxes ? `${kcNum(item.taxes)}` : ''} className={NUM_CELL} />
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {data.some((m) => m.fixedMissing) && (
        <p className={'mt-2 text-[12px] font-normal text-warn'}>
          Оклад не задан: в «Персонал → Ставки» нужна запись HPP с «from» не раньше первого дня роли.
        </p>
      )}
    </TableWrapper>
  )
}
