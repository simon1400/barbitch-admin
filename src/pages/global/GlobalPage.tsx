import Button from '../../components/Button'
import { Container } from '../../components/Container'
import { useState } from 'react'

import { BlocksContent } from '../dashboard/components/BlocksContent'
import { Select } from '../dashboard/components/Select'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'

import { GlobalLineChart } from './charts/components/GlobalLineChart'
import { Administrators } from './components/Administrators'
import { Compare } from './components/Compare'
import { Masters } from './components/Masters'
import { OwnerProtection } from './components/OwnerProtection'
import { QuickNav } from './components/QuickNav'
import { StatSection } from './components/StatSection'
import { Summary } from './components/Summary'
import { blockReservationsItems, blockStateItems } from './data'

const GlobalMonthStates = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const data = useGlobalMonthData(month)

  return (
    <OwnerProtection>
      <QuickNav />
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          {/* Header with controls */}
          <div className={'py-6 flex justify-between items-center sticky top-0 z-40'}>
            <Select month={month} setMonth={setMonth} />
            <div>
              <Button text={'Charts'} to={'/global/charts'} />
            </div>
          </div>

          {/* Overview Section */}
          <StatSection title={'Финансовый обзор'} id={'overview'} defaultOpen>
            <BlocksContent
              items={blockStateItems(
                data.noDphCosts,
                data.globalFlow,
                data.cashMoney,
                data.cardMoney,
                data.sumMasters,
                data.sumAdmins,
                data.payrollSum,
                data.voucherRealized,
                data.voucherPayed,
                data.qrMoney,
                data.extraMoney,
                data.costs,
              )}
            />
          </StatSection>

          {/* Reservations Section */}
          <StatSection title={'Резервации'} id={'reservations'} defaultOpen>
            <BlocksContent
              items={blockReservationsItems(
                data.clients.all,
                data.clients.payed,
                data.clients.noshow,
                data.clients.canceled,
                data.clients.free,
                data.clients.fixed,
                data.clients.personal,
                data.sumClientsDone,
                data.clients.pastPayed,
                data.clients.countCreatedMonthReservation,
                data.clients.countCreatedTodayReservation,
                data.clients.monthReservationIndex,
              )}
            />
          </StatSection>

          {/* Charts Section */}
          <StatSection title={'Графики'} id={'charts'} defaultOpen>
            <div className={'space-y-6'}>
              <GlobalLineChart
                data={data.daysResult}
                title={'Услуги'}
                lines={[{ dataKey: 'sum', stroke: '#e71e6e', name: 'Сумма' }]}
              />

              <GlobalLineChart
                data={data.dataMetrics}
                title={'Записи'}
                lines={[
                  { dataKey: 'countPayed', stroke: '#e71e6e', name: 'Резервации' },
                  { dataKey: 'countCanceled', stroke: '#161615', name: 'Отмены' },
                  { dataKey: 'countNoshow', stroke: 'orange', name: 'Не пришли' },
                ]}
              />
            </div>
          </StatSection>

          {/* Masters Section */}
          <StatSection title={'Мастера'} id={'masters'} defaultOpen>
            <Masters data={data.works} sumMasters={data.sumMasters} />
          </StatSection>

          {/* Administrators Section */}
          <StatSection title={'Администраторы'} id={'admins'} defaultOpen>
            <Administrators data={data.admins} sumAdmins={data.sumAdmins} />
          </StatSection>

          {/* Calculations Section */}
          <StatSection title={'Расчёты'} id={'calculations'} defaultOpen>
            <div className={'space-y-6'}>
              <Compare
                income={data.globalFlow}
                cash={data.cashMoney}
                card={data.cardMoney}
                payroll={data.payrollSum}
                voucherRealized={data.voucherRealized}
                qrMoney={data.qrMoney}
              />

              <Summary
                income={data.globalFlow}
                salary={data.sumMasters}
                salaryAdmin={data.sumAdmins}
                costs={data.noDphCosts}
                cash={data.cashMoney}
                card={data.cardMoney / 1.21}
                voucherPayed={data.voucherPayed}
                qrMoney={data.qrMoney / 1.21}
              />
            </div>
          </StatSection>
        </Container>
      </section>
    </OwnerProtection>
  )
}

export default GlobalMonthStates
