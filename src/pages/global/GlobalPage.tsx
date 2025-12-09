import Button from '../../components/Button'
import { Container } from '../../components/Container'
import { useState } from 'react'

import { BlocksContent } from '../dashboard/components/BlocksContent'
import { Select } from '../dashboard/components/Select'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'

import { GlobalLineChart } from './charts/components/GlobalLineChart'
import { Administrators } from './components/Administrators'
import { Masters } from './components/Masters'
import { OwnerProtection } from './components/OwnerProtection'
import { QuickNav } from './components/QuickNav'
import { StatSection } from './components/StatSection'
import { WeeklySection } from './components/WeeklySection'
import { blockReservationsItems, blockStateItems } from './data'

const GlobalMonthStates = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [showMenu, setShowMenu] = useState(false)
  const data = useGlobalMonthData(month)

  return (
    <OwnerProtection>
      <QuickNav />
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          {/* Header with controls */}
          <div className={'py-6 flex justify-between items-center sticky top-0 z-40'}>
            <Select month={month} setMonth={setMonth} />
            <div className="flex gap-3 items-center">
              {/* Dropdown Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="px-4 py-2 bg-white text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-md flex items-center gap-2"
                >
                  Nástroje
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                    <a
                      href="/voucher-confirmation"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setShowMenu(false)}
                    >
                      Potvrzení voucheru
                    </a>
                    <a
                      href="/email-campaign"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setShowMenu(false)}
                    >
                      Email kampaň
                    </a>
                  </div>
                )}
              </div>
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
                data.cardExtraIncome,
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

          {/* Weekly Section */}
          <StatSection title={'📅 Недельный обзор'} id={'weekly'}>
            <WeeklySection />
          </StatSection>
        </Container>
      </section>
    </OwnerProtection>
  )
}

export default GlobalMonthStates
