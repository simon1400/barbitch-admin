import { Container } from '../../components/Container'
import { useState } from 'react'
import { Select } from '../dashboard/components/Select'
import { useGlobalMonthData } from '../dashboard/hooks/useGlobalMonthData'
import { Administrators } from './components/Administrators'
import { Masters } from './components/Masters'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'

const SalariesPage = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const data = useGlobalMonthData(month, year)

  return (
    <OwnerProtection>
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          <div className={'py-6 flex justify-between items-center sticky top-0 z-40'}>
            <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          </div>

          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Зарплаты</h2>
          </div>

          {/* Masters Section */}
          <StatSection title={'Мастера'} id={'masters'} defaultOpen>
            <Masters data={data.works} sumMasters={data.sumMasters} />
          </StatSection>

          {/* Administrators Section */}
          <StatSection title={'Администраторы'} id={'admins'} defaultOpen>
            <Administrators data={data.admins} sumAdmins={data.sumAdmins} />
          </StatSection>
        </Container>
      </section>
    </OwnerProtection>
  )
}

export default SalariesPage
