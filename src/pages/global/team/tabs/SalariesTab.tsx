import { useState } from 'react'
import { RefreshControl } from '../../../dashboard/components/RefreshControl'
import { Select } from '../../../dashboard/components/Select'
import { useGlobalMonthData } from '../../../dashboard/hooks/useGlobalMonthData'
import { toolbarCardCls } from '../../../../ui/kit'
import { Administrators } from '../../components/Administrators'
import { Combined } from '../../components/Combined'
import { Masters } from '../../components/Masters'
import { StatSection } from '../../components/StatSection'

export default function SalariesTab() {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const { data, loading, cachedAt, refresh } = useGlobalMonthData(month, year)

  return (
    <>
      <div className={toolbarCardCls}>
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
        <RefreshControl cachedAt={cachedAt} loading={loading} refresh={refresh} />
      </div>

      {/* Masters Section */}
      <StatSection title={'Мастера'} id={'masters'} count={data.works.length} defaultOpen>
        <Masters data={data.works} sumMasters={data.sumMasters} />
      </StatSection>

      {/* Administrators Section */}
      <StatSection title={'Администраторы'} id={'admins'} count={data.admins.length} defaultOpen>
        <Administrators data={data.admins} sumAdmins={data.sumAdmins} />
      </StatSection>

      {/* Combined (master + administrator) Section */}
      {data.combined.length > 0 && (
        <StatSection
          title={'Совместители (мастер + админ)'}
          id={'combined'}
          count={data.combined.length}
          defaultOpen
        >
          <Combined data={data.combined} sumCombined={data.sumCombined} />
        </StatSection>
      )}
    </>
  )
}
