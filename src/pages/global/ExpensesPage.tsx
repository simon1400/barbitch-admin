import { useState, useEffect, useMemo } from 'react'
import { h1Cls, kickerCls, pageShellCls, toolbarCardCls } from '../../ui/kit'
import { Select } from '../dashboard/components/Select'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { getExpenses } from './fetch/expenses'
import type { IExpenseItem } from './fetch/expenses'
import { Cell } from '../dashboard/components/Cell'
import { TableWrapper } from './components/TableWrapper'
import { ExpensesBarChart } from './components/ExpensesBarChart'

const ExpensesPage = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [expenses, setExpenses] = useState<IExpenseItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    getExpenses(month, year)
      .then((data) => {
        setExpenses(data)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [month, year])

  const totalSum = expenses.reduce((sum, item) => sum + item.sum, 0)
  const totalNoDph = expenses.reduce((sum, item) => sum + (item.noDph || 0), 0)

  // Группируем затраты по категориям для графика
  const chartData = useMemo(() => {
    const grouped = expenses.reduce((acc, expense) => {
      const categoryName = expense.category || 'Другое'
      const existing = acc.find((item) => item.name === categoryName)
      if (existing) {
        existing.sum += expense.sum
        existing.noDph = (existing.noDph || 0) + (expense.noDph || 0)
      } else {
        acc.push({
          name: categoryName,
          sum: expense.sum,
          noDph: expense.noDph || 0,
        })
      }
      return acc
    }, [] as { name: string; sum: number; noDph: number }[])

    return grouped
  }, [expenses])

  return (
    <OwnerProtection>
      <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>Затраты</h1>

        <div className={toolbarCardCls}>
          <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
        </div>

        {/* График затрат */}
        {!isLoading && expenses.length > 0 && (
          <div className={'mb-3.5'}>
            <ExpensesBarChart data={chartData} title={'Затраты по категориям'} />
          </div>
        )}

        <StatSection
          title={'Таблица затрат'}
          id={'expenses'}
          count={expenses.length}
          defaultOpen
        >
          {isLoading ? (
            <div className={'py-12 text-center text-[13px] font-semibold text-ink-faint'}>
              Загрузка...
            </div>
          ) : expenses.length === 0 ? (
            <div className={'py-12 text-center text-[13px] font-semibold text-ink-faint'}>
              Нет данных за выбранный период
            </div>
          ) : (
            <TableWrapper
              totalSum={`Всего: ${totalSum.toLocaleString()} Kč`}
              totalLabel={'Общая сумма'}
              additionalInfo={`Без DPH: ${totalNoDph.toLocaleString()} Kč`}
            >
              <table className={'w-full text-left min-w-[620px]'}>
                <thead>
                  <tr>
                    <Cell title={'Дата'} asHeader />
                    <Cell title={'Название'} asHeader />
                    <Cell title={'Комментарий'} asHeader />
                    <Cell title={'Сумма'} asHeader className={'text-right'} />
                    <Cell title={'Без DPH'} asHeader className={'text-right'} />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} className={'hover:bg-surface-hover transition-colors'}>
                      <Cell title={new Date(expense.date).toLocaleDateString('cs-CZ')} />
                      <Cell
                        title={expense.name}
                        className={'text-[14px] font-bold text-ink'}
                      />
                      <Cell title={expense.comment || '-'} className={'text-ink-soft'} />
                      <Cell
                        title={`${expense.sum.toLocaleString()} Kč`}
                        className={'text-right text-[14px] font-extrabold text-brand-dark'}
                      />
                      <Cell
                        title={expense.noDph ? `${expense.noDph.toLocaleString()} Kč` : '-'}
                        className={'text-right text-ink-soft'}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          )}
        </StatSection>
      </div>
    </OwnerProtection>
  )
}

export default ExpensesPage
