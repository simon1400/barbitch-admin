import { useState } from 'react'

import { BlocksContent } from '../dashboard/components/BlocksContent'
import { RefreshControl } from '../dashboard/components/RefreshControl'
import { Select } from '../dashboard/components/Select'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'
import { h1Cls, kickerCls, pageShellCls, toolbarCardCls } from '../../ui/kit'

import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { blockReservationsItems, blockStateItems } from './data'

const GlobalMonthStates = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const { data, loading, cachedAt, refresh } = useGlobalMonthData(month, year)

  return (
    <OwnerProtection>
      <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>Главная</h1>

        {/* Тулбар: период + обновление кэша месяца */}
        <div className={toolbarCardCls}>
          <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          <RefreshControl cachedAt={cachedAt} loading={loading} refresh={refresh} />
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
      </div>
    </OwnerProtection>
  )
}

export default GlobalMonthStates
