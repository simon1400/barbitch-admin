import { Container } from '../../components/Container'
import { useState } from 'react'

import { BlocksContent } from '../dashboard/components/BlocksContent'
import { Select } from '../dashboard/components/Select'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'

import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { blockReservationsItems, blockStateItems } from './data'

const GlobalMonthStates = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const data = useGlobalMonthData(month, year)

  return (
    <OwnerProtection>
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          {/* Header with controls */}
          <div className={'py-6 sticky top-0 z-40'}>
            <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
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
