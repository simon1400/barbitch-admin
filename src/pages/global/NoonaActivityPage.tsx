import { Container } from '../../components/Container'
import { OwnerProtection } from './components/OwnerProtection'
import { NoonaActivityLog } from './components/NoonaActivityLog'

export default function NoonaActivityPage() {
  return (
    <OwnerProtection>
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          <div className="pt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Historie akcí v Noona
            </h2>
            <NoonaActivityLog />
          </div>
        </Container>
      </section>
    </OwnerProtection>
  )
}
