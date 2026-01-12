/* eslint-disable @typescript-eslint/no-explicit-any */
import { Container } from '../../components/Container'
import { useState, useEffect, useMemo } from 'react'
import { Cell } from '../dashboard/components/Cell'
import { TableWrapper } from '../global/components/TableWrapper'
import { StatSection } from '../global/components/StatSection'
import { Select } from '../dashboard/components/Select'
import { GlobalLineChart } from '../global/charts/components/GlobalLineChart'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'

interface AdministratorData {
  username: string
  role: string
  personal: {
    name: string
    position: string
    excessThreshold: number
    rates: any[]
    ratePercent: number
  }
  penalties: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  payrolls: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  workTimes: Array<{
    id: number
    start: string
    sum: number
    comment: string
  }>
  advances: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  salaries: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  extraProfits: Array<{
    id: number
    sum: number | string
    date: string
    title: string
  }>
  shifts: any[]
}

interface Payment {
  id: number
  sum: number | string
  date: string
  comment?: string
  title?: string
  type: 'advance' | 'salary' | 'bonus'
}

const AdministratorCabinetPage = () => {
  const [data, setData] = useState<AdministratorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [workTimesPage, setWorkTimesPage] = useState(1)
  const workTimesPerPage = 10

  const username = localStorage.getItem('usernameLocalData')
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337'

  // Получаем глобальные данные для графиков
  const globalData = useGlobalMonthData(selectedMonth, selectedYear)

  useEffect(() => {
    const fetchData = async () => {
      if (!username) {
        setError('Пользователь не авторизован')
        setLoading(false)
        return
      }

      try {
        const response = await fetch(
          `${API_URL}/api/admin-users/administrator-data/${username}`,
        )

        if (!response.ok) {
          throw new Error('Не удалось загрузить данные')
        }

        const result = await response.json()
        console.log('Administrator data:', result)
        console.log('Extra profits:', result.extraProfits)
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Произошла ошибка')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [username, API_URL])

  // Фильтрация данных по выбранному месяцу и году
  const filteredData = useMemo(() => {
    if (!data) return null

    const filterByMonth = (items: any[], dateField: string) => {
      return items.filter((item) => {
        const itemDate = new Date(item[dateField])
        return itemDate.getMonth() === selectedMonth && itemDate.getFullYear() === selectedYear
      })
    }

    return {
      workTimes: filterByMonth(data.workTimes, 'start').sort(
        (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
      ),
      penalties: filterByMonth(data.penalties, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      payrolls: filterByMonth(data.payrolls, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      advances: filterByMonth(data.advances, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      salaries: filterByMonth(data.salaries, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      extraProfits: filterByMonth(data.extraProfits, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    }
  }, [data, selectedMonth, selectedYear])

  // Объединенные выплаты (только авансы и зарплаты, без премий)
  const allPayments = useMemo(() => {
    if (!filteredData) return []

    const payments: Payment[] = [
      ...filteredData.advances.map((a) => ({ ...a, type: 'advance' as const })),
      ...filteredData.salaries.map((s) => ({ ...s, type: 'salary' as const })),
    ]

    return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [filteredData])

  // Пагинация для рабочих часов
  const paginatedWorkTimes = useMemo(() => {
    if (!filteredData) return []
    const startIndex = (workTimesPage - 1) * workTimesPerPage
    return filteredData.workTimes.slice(startIndex, startIndex + workTimesPerPage)
  }, [filteredData, workTimesPage])

  const workTimesTotalPages = useMemo(() => {
    if (!filteredData) return 0
    return Math.ceil(filteredData.workTimes.length / workTimesPerPage)
  }, [filteredData])

  // Последние 5 смен
  const recentShifts = useMemo(() => {
    if (!data) return []
    return [...data.shifts]
      .sort((a, b) => new Date(b.from).getTime() - new Date(a.from).getTime())
      .slice(0, 5)
  }, [data])

  if (loading) {
    return (
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          <div className={'py-6 text-center text-gray-600'}>Загрузка...</div>
        </Container>
      </section>
    )
  }

  if (error || !data || !filteredData) {
    return (
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          <div className={'py-6 text-center text-red-600'}>
            {error || 'Данные не найдены'}
          </div>
        </Container>
      </section>
    )
  }

  // Функция для получения ставки для месяца
  const getRateForMonth = (rates: any[], month: number, year: number) => {
    if (!rates || rates.length === 0) return 115 // дефолтная ставка

    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    const MAX_DATE = new Date(8640000000000000)

    const found = rates.find((r: any) => {
      const from = r.from ? new Date(r.from) : new Date(0)
      const to = r.to ? new Date(r.to) : MAX_DATE
      return from <= monthEnd && to >= monthStart
    })

    const val = found?.rate
    const num = typeof val === 'string' ? Number(val) : val
    return Number.isFinite(num as number) ? (num as number) : 115
  }

  // Рассчитываем общий заработок
  const totalHours = filteredData.workTimes.reduce((sum, wt) => sum + Number(wt.sum), 0)
  const rate = getRateForMonth(data.personal.rates, selectedMonth, selectedYear)
  const totalEarnings = totalHours * rate

  // Рассчитываем штрафы
  const totalPenalties = filteredData.penalties.reduce((sum, p) => sum + Number(p.sum), 0)

  // Рассчитываем премии из extraProfits (add-moneys)
  const totalBonuses = filteredData.extraProfits.reduce((sum, ep) => sum + Number(ep.sum), 0)

  // Рассчитываем списывания
  const totalPayrolls = filteredData.payrolls.reduce((sum, p) => sum + Number(p.sum), 0)

  // Рассчитываем результат
  const result = totalEarnings + totalBonuses - totalPenalties - totalPayrolls

  // Рассчитываем общую сумму выплат
  const totalPayments = allPayments.reduce((sum, p) => sum + Number(p.sum), 0)

  const getPaymentTypeLabel = (type: Payment['type']) => {
    switch (type) {
      case 'advance':
        return 'Аванс'
      case 'salary':
        return 'Зарплата'
      case 'bonus':
        return 'Премия'
    }
  }

  const getPaymentTypeColor = (type: Payment['type']) => {
    switch (type) {
      case 'advance':
        return 'text-blue-600'
      case 'salary':
        return 'text-primary'
      case 'bonus':
        return 'text-green-600'
    }
  }

  return (
    <section className={'pb-20 min-h-screen'}>
      <Container size={'lg'}>
        {/* Header with month selector */}
        <div className={'py-6 flex justify-between items-center'}>
          <div>
            <h1 className={'text-3xl font-bold text-gray-800'}>Личный кабинет</h1>
            <p className={'text-gray-600 mt-2'}>{data.personal.name}</p>
          </div>
          <Select month={selectedMonth} setMonth={setSelectedMonth} year={selectedYear} setYear={setSelectedYear} />
        </div>

        {/* Summary Section */}
        <StatSection title={'Финансовый обзор'} id={'financial-overview'} defaultOpen>
          <div className={'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
            <div className={'bg-white p-6 rounded-lg shadow-md border border-gray-200'}>
              <div className={'text-sm text-gray-600'}>Отработано часов</div>
              <div className={'text-2xl font-bold text-gray-800 mt-2'}>
                {totalHours.toLocaleString()} hod
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-gray-200'}>
              <div className={'text-sm text-gray-600'}>Заработок</div>
              <div className={'text-2xl font-bold text-primary mt-2'}>
                {totalEarnings.toLocaleString()} Kč
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-gray-200'}>
              <div className={'text-sm text-gray-600'}>Штрафы</div>
              <div className={'text-2xl font-bold text-red-600 mt-2'}>
                -{totalPenalties.toLocaleString()} Kč
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-gray-200'}>
              <div className={'text-sm text-gray-600'}>Премии</div>
              <div className={'text-2xl font-bold text-green-600 mt-2'}>
                +{totalBonuses.toLocaleString()} Kč
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-gray-200'}>
              <div className={'text-sm text-gray-600'}>Списывания</div>
              <div className={'text-2xl font-bold text-orange-600 mt-2'}>
                -{totalPayrolls.toLocaleString()} Kč
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-gray-200'}>
              <div className={'text-sm text-gray-600'}>Результат</div>
              <div className={'text-2xl font-bold text-primary mt-2'}>
                {result.toLocaleString()} Kč
              </div>
            </div>
          </div>
        </StatSection>

        {/* Charts Section */}
        <StatSection title={'Графики'} id={'charts'} defaultOpen>
          <div className={'space-y-6'}>

            <GlobalLineChart
              data={globalData.dataMetrics}
              title={'Записи'}
              lines={[
                { dataKey: 'countPayed', stroke: '#e71e6e', name: 'Резервации' },
                { dataKey: 'countCanceled', stroke: '#161615', name: 'Отмены' },
                { dataKey: 'countNoshow', stroke: 'orange', name: 'Не пришли' },
              ]}
            />
          </div>
        </StatSection>

        {/* Work Times Section with Pagination */}
        <StatSection title={'Рабочие часы'} id={'work-times'} defaultOpen>
          <TableWrapper
            totalSum={`${totalHours.toLocaleString()} часов`}
            totalLabel={'Всего отработано'}
          >
            <table className={'w-full text-left table-auto min-w-max'}>
              <thead>
                <tr>
                  <Cell title={'Дата'} asHeader />
                  <Cell title={'Часов'} asHeader />
                  <Cell title={'Комментарий'} asHeader />
                </tr>
              </thead>
              <tbody>
                {paginatedWorkTimes.map((wt) => (
                  <tr key={wt.id} className={'hover:bg-gray-50 transition-colors'}>
                    <Cell title={new Date(wt.start).toLocaleDateString('ru-RU')} />
                    <Cell title={`${Number(wt.sum).toLocaleString()} hod`} />
                    <Cell
                      title={
                        wt.comment
                          ? wt.comment.replace(/<[^>]*>/g, '').substring(0, 100)
                          : '-'
                      }
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>

          {/* Pagination for Work Times */}
          {workTimesTotalPages > 1 && (
            <div className={'flex justify-center gap-2 mt-4'}>
              <button
                onClick={() => setWorkTimesPage((p) => Math.max(1, p - 1))}
                disabled={workTimesPage === 1}
                className={
                  'px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100'
                }
              >
                Назад
              </button>
              <span className={'px-4 py-2'}>
                Страница {workTimesPage} из {workTimesTotalPages}
              </span>
              <button
                onClick={() => setWorkTimesPage((p) => Math.min(workTimesTotalPages, p + 1))}
                disabled={workTimesPage === workTimesTotalPages}
                className={
                  'px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100'
                }
              >
                Вперед
              </button>
            </div>
          )}
        </StatSection>

        {/* Bonuses Section */}
        {filteredData.extraProfits.length > 0 && (
          <StatSection title={'Премии'} id={'bonuses'}>
            <TableWrapper
              totalSum={`${totalBonuses.toLocaleString()} Kč`}
              totalLabel={'Всего премий'}
            >
              <table className={'w-full text-left table-auto min-w-max'}>
                <thead>
                  <tr>
                    <Cell title={'Дата'} asHeader />
                    <Cell title={'Сумма'} asHeader />
                    <Cell title={'Комментарий'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.extraProfits.map((bonus) => (
                    <tr key={bonus.id} className={'hover:bg-gray-50 transition-colors'}>
                      <Cell title={new Date(bonus.date).toLocaleDateString('ru-RU')} />
                      <Cell
                        title={`+${Number(bonus.sum).toLocaleString()} Kč`}
                        className={'text-green-600 font-semibold'}
                      />
                      <Cell title={bonus.title || '-'} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          </StatSection>
        )}

        {/* Penalties Section */}
        {filteredData.penalties.length > 0 && (
          <StatSection title={'Штрафы'} id={'penalties'}>
            <TableWrapper
              totalSum={`${totalPenalties.toLocaleString()} Kč`}
              totalLabel={'Всего штрафов'}
            >
              <table className={'w-full text-left table-auto min-w-max'}>
                <thead>
                  <tr>
                    <Cell title={'Дата'} asHeader />
                    <Cell title={'Сумма'} asHeader />
                    <Cell title={'Комментарий'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.penalties.map((penalty) => (
                    <tr key={penalty.id} className={'hover:bg-gray-50 transition-colors'}>
                      <Cell title={new Date(penalty.date).toLocaleDateString('ru-RU')} />
                      <Cell
                        title={`-${Number(penalty.sum).toLocaleString()} Kč`}
                        className={'text-red-600 font-semibold'}
                      />
                      <Cell title={penalty.comment || '-'} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          </StatSection>
        )}

        {/* Payrolls Section */}
        {filteredData.payrolls.length > 0 && (
          <StatSection title={'Списывания с зарплаты'} id={'payrolls'}>
            <TableWrapper
              totalSum={`${totalPayrolls.toLocaleString()} Kč`}
              totalLabel={'Всего списано'}
            >
              <table className={'w-full text-left table-auto min-w-max'}>
                <thead>
                  <tr>
                    <Cell title={'Дата'} asHeader />
                    <Cell title={'Сумма'} asHeader />
                    <Cell title={'Комментарий'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.payrolls.map((payroll) => (
                    <tr key={payroll.id} className={'hover:bg-gray-50 transition-colors'}>
                      <Cell title={new Date(payroll.date).toLocaleDateString('ru-RU')} />
                      <Cell
                        title={`-${Number(payroll.sum).toLocaleString()} Kč`}
                        className={'text-orange-600 font-semibold'}
                      />
                      <Cell title={payroll.comment || '-'} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          </StatSection>
        )}

        {/* Combined Payments Section (Advances and Salaries) */}
        {allPayments.length > 0 && (
          <StatSection title={'Выплаты (Авансы и Зарплаты)'} id={'payments'}>
            <TableWrapper
              totalSum={`${totalPayments.toLocaleString()} Kč`}
              totalLabel={'Всего выплачено'}
            >
              <table className={'w-full text-left table-auto min-w-max'}>
                <thead>
                  <tr>
                    <Cell title={'Дата'} asHeader />
                    <Cell title={'Тип'} asHeader />
                    <Cell title={'Сумма'} asHeader />
                    <Cell title={'Комментарий'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((payment) => (
                    <tr key={`${payment.type}-${payment.id}`} className={'hover:bg-gray-50 transition-colors'}>
                      <Cell title={new Date(payment.date).toLocaleDateString('ru-RU')} />
                      <Cell title={getPaymentTypeLabel(payment.type)} />
                      <Cell
                        title={`${Number(payment.sum).toLocaleString()} Kč`}
                        className={`${getPaymentTypeColor(payment.type)} font-semibold`}
                      />
                      <Cell title={payment.comment || '-'} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          </StatSection>
        )}

        {/* Shifts Section */}
        {data.shifts.length > 0 && (
          <StatSection title={'Рабочие смены'} id={'shifts'}>
            <div className={'space-y-4'}>
              {recentShifts.map((shift) => (
                <div
                  key={shift.id}
                  className={'bg-white p-4 md:p-6 rounded-lg shadow-md border border-gray-200'}
                >
                  <div className={'font-semibold text-gray-800 mb-3 md:mb-4 text-sm md:text-base'}>
                    {new Date(shift.from).toLocaleDateString('ru-RU')} -{' '}
                    {new Date(shift.to).toLocaleDateString('ru-RU')}
                  </div>
                  {shift.days && (
                    <div className={'grid grid-cols-7 gap-1 md:gap-2'}>
                      {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map(
                        (day, index) => {
                          const dayKey = [
                            'monday',
                            'tuesday',
                            'wednesday',
                            'thursday',
                            'friday',
                            'saturday',
                            'sunday',
                          ][index]
                          const person = shift.days[dayKey]
                          return (
                            <div
                              key={day}
                              className={'text-center p-1.5 md:p-2 bg-gray-50 rounded border border-gray-200'}
                            >
                              <div className={'text-[10px] md:text-xs font-medium text-gray-600 mb-0.5 md:mb-1'}>
                                {day.substring(0, 2)}
                              </div>
                              <div className={'text-[10px] md:text-xs text-gray-800 break-words leading-tight'}>
                                {person || '-'}
                              </div>
                            </div>
                          )
                        },
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </StatSection>
        )}
      </Container>
    </section>
  )
}

export default AdministratorCabinetPage
