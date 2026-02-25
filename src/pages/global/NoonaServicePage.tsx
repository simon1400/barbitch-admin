import { Container } from '../../components/Container'
import { OwnerProtection } from './components/OwnerProtection'
import { NoonaServiceForm } from './components/NoonaServiceForm'

export default function NoonaServicePage() {
  return (
    <OwnerProtection>
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          <div className="pt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Варианты услуги в Noona</h2>
            <NoonaServiceForm />
          </div>
        </Container>
      </section>
    </OwnerProtection>
  )
}
