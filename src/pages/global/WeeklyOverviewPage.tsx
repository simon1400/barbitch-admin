import { Container } from '../../components/Container'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { WeeklySection } from './components/WeeklySection'

const WeeklyOverviewPage = () => {
  return (
    <OwnerProtection>
      <section className={'pb-20 min-h-screen'}>
        <Container size={'lg'}>
          <div className={'py-6'}>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Недельный обзор</h2>
          </div>

          <StatSection title={'Недельный обзор'} id={'weekly'} defaultOpen>
            <WeeklySection />
          </StatSection>
        </Container>
      </section>
    </OwnerProtection>
  )
}

export default WeeklyOverviewPage
