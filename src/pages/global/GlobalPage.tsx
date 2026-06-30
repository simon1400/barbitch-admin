import { Container } from '../../components/Container'
import { useState } from 'react'

import { BlocksContent } from '../dashboard/components/BlocksContent'
import { Select } from '../dashboard/components/Select'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'

import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { blockReservationsItems, blockStateItems } from './data'

const formatAgo = (ts: number): string => {
  if (!ts) return ''
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'обновлено только что'
  const min = Math.floor(sec / 60)
  if (min < 60) return `обновлено ${min} мин назад`
  const hour = Math.floor(min / 60)
  return `обновлено ${hour} ч назад`
}

const GlobalMonthStates = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const { data, loading, cachedAt, refresh } = useGlobalMonthData(month, year)

  return (
    <OwnerProtection>
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          {/* Header with controls */}
          <div className={'py-6 sticky top-0 z-40 flex items-center justify-between gap-3'}>
            <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
            <div className="flex items-center gap-2">
              {cachedAt > 0 && (
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatAgo(cachedAt)}</span>
              )}
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="px-3 py-2 rounded-lg text-sm font-semibold border bg-white text-gray-700 border-gray-300 shadow-sm hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? 'Обновление…' : 'Обновить'}
              </button>
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
                data.salonSalariesCash,
                data.salonSalariesCard,
                data.taxesSum,
                data.sumCombined,
                data.combinedAdminEarnings,
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
                // data.clients.free,
                data.clients.fixed,
                // data.clients.personal,
                data.sumClientsDone,
                data.clients.pastPayed,
                data.clients.countCreatedMonthReservation,
                data.clients.countCreatedTodayReservation,
                data.clients.monthReservationIndex,
              )}
            />
          </StatSection>
        </Container>
      </section>
    </OwnerProtection>
  )
}

export default GlobalMonthStates
