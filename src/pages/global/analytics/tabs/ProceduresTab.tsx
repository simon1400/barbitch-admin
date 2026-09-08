import { useMonthYear } from '../../../../hooks/useMonthYear'

import { Select } from '../../../dashboard/components/Select'
import { StatSection } from '../../components/StatSection'
import { ProceduresTable } from '../../components/ProceduresTable'
import { useProceduresData } from '../../hooks/useProceduresData'
import { toolbarCardCls } from '../../../../ui/kit'

export default function ProceduresTab() {
  const { month, setMonth, year, setYear } = useMonthYear()
  const { procedures, totalCount, totalRevenue, loading } = useProceduresData(month, year)

  return (
    <>
      <div className={toolbarCardCls}>
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
