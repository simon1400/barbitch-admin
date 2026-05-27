import { StatSection } from '../../components/StatSection'
import { WeeklySection } from '../../components/WeeklySection'

export default function OverviewTab() {
  return (
    <StatSection title="Недельный обзор" id="weekly" defaultOpen>
      <WeeklySection />
    </StatSection>
  )
}
