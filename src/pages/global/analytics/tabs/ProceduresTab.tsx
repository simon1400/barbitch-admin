import { useState } from 'react'

import { Select } from '../../../dashboard/components/Select'
import { StatSection } from '../../components/StatSection'
import { ProceduresTable } from '../../components/ProceduresTable'
import { useProceduresData } from '../../hooks/useProceduresData'

export default function ProceduresTab() {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const { procedures, totalCount, totalRevenue, loading } = useProceduresData(month, year)

  return (
    <>
      <div className="mb-6 flex justify-between items-center sticky top-0 z-40">
        <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
      </div>

      <StatSection title="Процедуры за месяц" id="procedures" defaultOpen>
        <ProceduresTable
          data={procedures}
          totalCount={totalCount}
          totalRevenue={totalRevenue}
          loading={loading}
        />
      </StatSection>
    </>
  )
}
