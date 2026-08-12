/* eslint-disable @typescript-eslint/no-explicit-any */
import { h1Cls, kickerCls, pageShellCls, toolbarCardCls } from '../../ui/kit'
import { useState, useEffect, useMemo } from 'react'
import { Cell } from '../dashboard/components/Cell'
import { TableWrapper } from '../global/components/TableWrapper'
import { StatSection } from '../global/components/StatSection'
import { Select } from '../dashboard/components/Select'
import { GlobalLineChart } from '../global/charts/components/GlobalLineChart'
import { rateInfoForDate } from '../dashboard/fetch/allAdminsHours'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'
import { CHART } from '../../ui/chartColors'

interface ServiceProvided {
  id: number
  date: string
  staffSalaries: string | number
  salonSalaries: string | number
  tip: string | number
  clientName?: string
  offer?: {
    id: number
    title: string
  }
}

interface MasterData {
  personalId: number
  name: string
  ratePercent: number
  excessThreshold: number
  servicesProvided: ServiceProvided[]
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
  advances: Array<{
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
  salaries: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
}

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
    date: string
    startTime: string
    endTime: string
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
  masterData: MasterData | null
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
  const { data: globalData } = useGlobalMonthData(selectedMonth, selectedYear)

  useEffect(() => {
    const fetchData = async () => {
      if (!username) {
        setError('Пользователь не авторизован')
        setLoading(false)
        return
      }

      try {
        const token = localStorage.getItem('userJwt')
        const response = await fetch(
          `${API_URL}/api/admin-users/administrator-data/${username}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        )

        if (!response.ok) {
          throw new Error('Не удалось загрузить данные')
        }

        const result = await response.json()
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
      workTimes: filterByMonth(data.workTimes, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
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

  // Фильтрация данных мастера по выбранному месяцу и году
  const filteredMasterData = useMemo(() => {
    if (!data?.masterData) return null

    const filterByMonth = (items: any[], dateField: string) => {
      return items.filter((item) => {
        const itemDate = new Date(item[dateField])
        return itemDate.getMonth() === selectedMonth && itemDate.getFullYear() === selectedYear
      })
    }

    return {
      servicesProvided: filterByMonth(data.masterData.servicesProvided, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      penalties: filterByMonth(data.masterData.penalties, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      payrolls: filterByMonth(data.masterData.payrolls, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      advances: filterByMonth(data.masterData.advances, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      extraProfits: filterByMonth(data.masterData.extraProfits, 'date').sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      salaries: filterByMonth(data.masterData.salaries, 'date').sort(
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

  // Рассчитываем заработок мастера (если есть данные мастера)
  // ВАЖНО: useMemo должен быть до условных return
  // Премии и штрафы НЕ включаем - они уже учтены в основном финансовом обзоре (один человек)
  const masterEarnings = useMemo(() => {
    if (!filteredMasterData || !data?.masterData) return null

    const staffSalaries = filteredMasterData.servicesProvided.reduce(
      (sum, sp) => sum + Number(sp.staffSalaries || 0),
      0
    )
    const tips = filteredMasterData.servicesProvided.reduce(
      (sum, sp) => sum + Number(sp.tip || 0),
      0
    )
    // Результат мастера = только заработок за услуги + чаевые
    const totalResult = staffSalaries + tips

    return {
      staffSalaries,
      tips,
      result: totalResult,
      servicesCount: filteredMasterData.servicesProvided.length,
    }
  }, [filteredMasterData, data?.masterData])

  if (loading) {
    return (
      <div className={pageShellCls}>
        <div className={'py-12 text-center text-[13px] font-semibold text-ink-faint'}>
          Загрузка...
        </div>
      </div>
    )
  }

  if (error || !data || !filteredData) {
    return (
      <div className={pageShellCls}>
        <div className={'py-12 text-center text-[13px] font-semibold text-brand-alert'}>
          {error || 'Данные не найдены'}
        </div>
      </div>
    )
  }

  // Рассчитываем общий заработок: каждая смена × ставка, действующая в ЕЁ дату
  // (ставка может смениться посреди месяца — тогда часть смен по старой, часть по новой)
  const totalHours = filteredData.workTimes.reduce((sum, wt) => sum + Number(wt.sum), 0)
  const totalEarnings = filteredData.workTimes.reduce(
    (sum, wt) => sum + Number(wt.sum) * rateInfoForDate(data.personal.rates, wt.date).rate,
    0,
  )

  // Рассчитываем штрафы
  const totalPenalties = filteredData.penalties.reduce((sum, p) => sum + Number(p.sum), 0)

  // Рассчитываем премии из extraProfits (add-moneys)
  const totalBonuses = filteredData.extraProfits.reduce((sum, ep) => sum + Number(ep.sum), 0)

  // Рассчитываем списывания
  const totalPayrolls = filteredData.payrolls.reduce((sum, p) => sum + Number(p.sum), 0)

  // Рассчитываем результат администратора
  const result = totalEarnings + totalBonuses - totalPenalties - totalPayrolls

  // Общий результат (администратор + мастер)
  const totalCombinedResult = result + (masterEarnings?.result || 0)

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
        return 'text-info'
      case 'salary':
        return 'text-brand'
      case 'bonus':
        return 'text-pos'
    }
  }

  return (
    <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>Главная</h1>

        {/* Header with month selector */}
        <div className={toolbarCardCls}>
          <Select month={selectedMonth} setMonth={setSelectedMonth} year={selectedYear} setYear={setSelectedYear} />
        </div>

        {/* Summary Section */}
        <StatSection title={'Финансовый обзор'} id={'financial-overview'} defaultOpen>
          <div className={'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
            <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
              <div className={'text-sm text-ink-muted'}>Отработано часов</div>
              <div className={'text-2xl font-bold text-ink mt-2'}>
                {totalHours.toLocaleString()} hod
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
              <div className={'text-sm text-ink-muted'}>Заработок</div>
              <div className={'text-2xl font-bold text-brand mt-2'}>
                {totalEarnings.toLocaleString()} Kč
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
              <div className={'text-sm text-ink-muted'}>Штрафы</div>
              <div className={'text-2xl font-bold text-neg mt-2'}>
                -{totalPenalties.toLocaleString()} Kč
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
              <div className={'text-sm text-ink-muted'}>Премии</div>
              <div className={'text-2xl font-bold text-pos mt-2'}>
                +{totalBonuses.toLocaleString()} Kč
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
              <div className={'text-sm text-ink-muted'}>Списывания</div>
              <div className={'text-2xl font-bold text-warn mt-2'}>
                -{totalPayrolls.toLocaleString()} Kč
              </div>
            </div>

            <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
              <div className={'text-sm text-ink-muted'}>Результат</div>
              <div className={'text-2xl font-bold text-brand mt-2'}>
                {result.toLocaleString()} Kč
              </div>
            </div>
          </div>
        </StatSection>

        {/* Master Earnings Section - показываем только если есть хотя бы одна проведённая услуга */}
        {masterEarnings && data?.masterData && masterEarnings.servicesCount > 0 && (
          <StatSection title={`Заработок мастера (${data.masterData.name})`} id={'master-earnings'} defaultOpen>
            <div className={'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
              <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
                <div className={'text-sm text-ink-muted'}>Услуг оказано</div>
                <div className={'text-2xl font-bold text-ink mt-2'}>
                  {masterEarnings.servicesCount}
                </div>
              </div>

              <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
                <div className={'text-sm text-ink-muted'}>Заработок за услуги</div>
                <div className={'text-2xl font-bold text-brand mt-2'}>
                  {masterEarnings.staffSalaries.toLocaleString()} Kč
                </div>
              </div>

              <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
                <div className={'text-sm text-ink-muted'}>Чаевые</div>
                <div className={'text-2xl font-bold text-info mt-2'}>
                  +{masterEarnings.tips.toLocaleString()} Kč
                </div>
              </div>

              <div className={'bg-white p-6 rounded-lg shadow-md border border-line'}>
                <div className={'text-sm text-ink-muted'}>Итого за мастера</div>
                <div className={'text-2xl font-bold text-purple-600 mt-2'}>
                  {masterEarnings.result.toLocaleString()} Kč
                </div>
              </div>
            </div>

            {/* Общий итог */}
            <div className={'mt-3.5 bg-brand-tint border border-brand-line rounded-xl px-6 py-5'}>
              <div className={'text-[10.5px] font-bold tracking-[0.06em] uppercase text-brand-dark mb-[5px]'}>
                Общий результат (Администратор + Мастер)
              </div>
              <div className={'text-[26px] font-extrabold text-brand-dark leading-[1.15]'}>
                {totalCombinedResult.toLocaleString()} Kč
              </div>
            </div>
          </StatSection>
        )}

        {/* Charts Section */}
        <StatSection title={'Графики'} id={'charts'} defaultOpen>
          <div className={'space-y-6'}>

            <GlobalLineChart
              data={globalData.dataMetrics}
              title={'Записи'}
              lines={[
                { dataKey: 'countPayed', stroke: CHART.brand, name: 'Резервации' },
                { dataKey: 'countCanceled', stroke: CHART.ink, name: 'Отмены' },
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
            <table className={'w-full text-left min-w-[620px]'}>
              <thead>
                <tr>
                  <Cell title={'Дата'} asHeader />
                  <Cell title={'Время'} asHeader />
                  <Cell title={'Часов'} asHeader />
                  <Cell title={'Комментарий'} asHeader />
                </tr>
              </thead>
              <tbody>
                {paginatedWorkTimes.map((wt) => (
                  <tr key={wt.id} className={'hover:bg-surface-hover transition-colors'}>
                    <Cell title={new Date(wt.date).toLocaleDateString('ru-RU')} />
                    <Cell
                      title={
                        wt.startTime && wt.endTime ? `${wt.startTime}–${wt.endTime}` : '-'
                      }
                    />
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
                  'px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-line-soft'
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
                  'px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-line-soft'
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
              <table className={'w-full text-left min-w-[620px]'}>
                <thead>
                  <tr>
                    <Cell title={'Дата'} asHeader />
                    <Cell title={'Сумма'} asHeader />
                    <Cell title={'Комментарий'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.extraProfits.map((bonus) => (
                    <tr key={bonus.id} className={'hover:bg-surface-hover transition-colors'}>
                      <Cell title={new Date(bonus.date).toLocaleDateString('ru-RU')} />
                      <Cell
                        title={`+${Number(bonus.sum).toLocaleString()} Kč`}
                        className={'text-pos font-semibold'}
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
              <table className={'w-full text-left min-w-[620px]'}>
                <thead>
                  <tr>
                    <Cell title={'Дата'} asHeader />
                    <Cell title={'Сумма'} asHeader />
                    <Cell title={'Комментарий'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.penalties.map((penalty) => (
                    <tr key={penalty.id} className={'hover:bg-surface-hover transition-colors'}>
                      <Cell title={new Date(penalty.date).toLocaleDateString('ru-RU')} />
                      <Cell
                        title={`-${Number(penalty.sum).toLocaleString()} Kč`}
                        className={'text-neg font-semibold'}
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
              <table className={'w-full text-left min-w-[620px]'}>
                <thead>
                  <tr>
                    <Cell title={'Дата'} asHeader />
                    <Cell title={'Сумма'} asHeader />
                    <Cell title={'Комментарий'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.payrolls.map((payroll) => (
                    <tr key={payroll.id} className={'hover:bg-surface-hover transition-colors'}>
                      <Cell title={new Date(payroll.date).toLocaleDateString('ru-RU')} />
                      <Cell
                        title={`-${Number(payroll.sum).toLocaleString()} Kč`}
                        className={'text-warn font-semibold'}
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
              <table className={'w-full text-left min-w-[620px]'}>
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
                    <tr key={`${payment.type}-${payment.id}`} className={'hover:bg-surface-hover transition-colors'}>
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

        {/* Master Services Section */}
        {filteredMasterData && filteredMasterData.servicesProvided.length > 0 && (
          <StatSection title={'Оказанные услуги (Мастер)'} id={'master-services'}>
            <TableWrapper
              totalSum={`${masterEarnings?.staffSalaries.toLocaleString() || 0} Kč`}
              totalLabel={'Всего заработано за услуги'}
            >
              <table className={'w-full text-left min-w-[620px]'}>
                <thead>
                  <tr>
                    <Cell title={'Дата'} asHeader />
                    <Cell title={'Клиент'} asHeader />
                    <Cell title={'Услуга'} asHeader />
                    <Cell title={'Заработок'} asHeader />
                    <Cell title={'Чаевые'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {filteredMasterData.servicesProvided.map((service) => (
                    <tr key={service.id} className={'hover:bg-surface-hover transition-colors'}>
                      <Cell title={new Date(service.date).toLocaleDateString('ru-RU')} />
                      <Cell title={service.clientName || '-'} />
                      <Cell title={service.offer?.title || '-'} />
                      <Cell
                        title={`${Number(service.staffSalaries || 0).toLocaleString()} Kč`}
                        className={'text-brand font-semibold'}
                      />
                      <Cell
                        title={Number(service.tip || 0) > 0 ? `+${Number(service.tip).toLocaleString()} Kč` : '-'}
                        className={'text-info'}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          </StatSection>
        )}
    </div>
  )
}

export default AdministratorCabinetPage
