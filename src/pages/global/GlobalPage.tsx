import { useCallback, useState } from 'react'

import { useMonthYear } from '../../hooks/useMonthYear'

import { BlocksContent } from '../dashboard/components/BlocksContent'
import { RefreshControl } from '../dashboard/components/RefreshControl'
import { Select } from '../dashboard/components/Select'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'
import { h1Cls, kickerCls, pageShellCls, toolbarCardCls } from '../../ui/kit'

import { DayBookingsTile } from './components/DayBookingsTile'
import { NowSection } from './components/NowSection'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { blockReservationsItems, blockStateItems } from './data'

const GlobalMonthStates = () => {
  const { month, setMonth, year, setYear } = useMonthYear()
  const { data, loading, cachedAt, refresh } = useGlobalMonthData(month, year)
  // «Сейчас» (s258) не в кэше месяца — кнопка обновления перечитывает и его
  const [nowKey, setNowKey] = useState(0)
  const refreshAll = useCallback(() => {
    refresh()
    setNowKey((k) => k + 1)
  }, [refresh])

  return (
    <OwnerProtection>
      <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>Главная</h1>

        {/* Тулбар: период + обновление кэша месяца */}
        <div className={toolbarCardCls}>
          <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          <RefreshControl cachedAt={cachedAt} loading={loading} refresh={refreshAll} />
        </div>

        {/* Касса и последняя закрытая смена (s258) */}
        <NowSection reloadKey={nowKey} />

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
              data.sumManagers,
              data.sumClientsDone,
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
              data.clients.fixed,
              data.sumClientsDone,
              data.clients.pastPayed,
              data.clients.countCreatedMonthReservation,
              data.clients.monthReservationIndex,
            )}
          >
            {/* «Зарезервировано за день» с переключением дней (s258) — вместо «Сегодня зарезерв.» */}
            <DayBookingsTile reloadKey={nowKey} />
          </BlocksContent>
        </StatSection>
      </div>
    </OwnerProtection>
  )
}

export default GlobalMonthStates
