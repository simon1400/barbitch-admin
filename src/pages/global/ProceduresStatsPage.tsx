import { useState } from 'react'

import { Container } from '../../components/Container'
import { Select } from '../dashboard/components/Select'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { ProceduresTable } from './components/ProceduresTable'
import { useProceduresData } from './hooks/useProceduresData'

const ProceduresStatsPage = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const { procedures, totalCount, totalRevenue, loading } = useProceduresData(month, year)

  return (
    <OwnerProtection>
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          <div className="py-6 flex justify-between items-center sticky top-0 z-40">
            <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          </div>

          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Статистика процедур</h2>
          </div>

          <StatSection title="Процедуры за месяц" id="procedures" defaultOpen>
            <ProceduresTable
              data={procedures}
              totalCount={totalCount}
              totalRevenue={totalRevenue}
              loading={loading}
            />
          </StatSection>
        </Container>
      </section>
    </OwnerProtection>
  )
}

export default ProceduresStatsPage
