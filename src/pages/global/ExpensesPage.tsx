import { Container } from '../../components/Container'
import { useState, useEffect, useMemo } from 'react'
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
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          <div className={'py-6 flex justify-between items-center sticky top-0 z-40'}>
            <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          </div>

          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Затраты</h2>
          </div>

          {/* График затрат */}
          {!isLoading && expenses.length > 0 && (
            <div className="mb-8">
              <ExpensesBarChart data={chartData} title={'Затраты по категориям'} />
            </div>
          )}

          <StatSection title={'Таблица затрат'} id={'expenses'} defaultOpen>
            {isLoading ? (
              <div className="text-center py-10">
                <p className="text-gray-500">Загрузка...</p>
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-500">Нет данных за выбранный период</p>
              </div>
            ) : (
              <TableWrapper
                totalSum={`Всего: ${totalSum.toLocaleString()} Kč`}
                totalLabel={'Общая сумма'}
                additionalInfo={`Без DPH: ${totalNoDph.toLocaleString()} Kč`}
              >
                <table className={'w-full text-left table-auto min-w-max'}>
                  <thead>
                    <tr>
                      <Cell title={'Дата'} asHeader />
                      <Cell title={'Название'} asHeader />
                      <Cell title={'Комментарий'} asHeader />
                      <Cell title={'Сумма'} asHeader />
                      <Cell title={'Без DPH'} asHeader />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id} className={'hover:bg-gray-50 transition-colors'}>
                        <Cell
                          title={new Date(expense.date).toLocaleDateString('cs-CZ')}
                        />
                        <Cell title={expense.name} className={'font-medium'} />
                        <Cell title={expense.comment || '-'} className={'text-gray-600'} />
                        <Cell
                          title={`${expense.sum.toLocaleString()} Kč`}
                          className={'font-semibold text-primary'}
                        />
                        <Cell
                          title={expense.noDph ? `${expense.noDph.toLocaleString()} Kč` : '-'}
                          className={'text-gray-600'}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrapper>
            )}
          </StatSection>
        </Container>
      </section>
    </OwnerProtection>
  )
}

export default ExpensesPage
