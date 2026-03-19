import { useState, useEffect, useCallback } from 'react';
import { Container } from '../../components/Container';
import { OwnerProtection } from './components/OwnerProtection';
import { PlanGenerator } from './components/blogAi/PlanGenerator';
import { PlanCard } from './components/blogAi/PlanCard';
import type { BlogPlan } from './fetch/blogAi';
import { fetchPlans } from './fetch/blogAi';

const strapiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337';

export default function BlogAIPage() {
  const [plans, setPlans] = useState<BlogPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlans();
      setPlans(data);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  return (
    <OwnerProtection>
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          <div className="mt-8 mb-6">
            <h1 className="text-md md:text-lg font-bold text-gray-800">Blog AI</h1>
          </div>

          <PlanGenerator onGenerated={loadPlans} />

          <div className="mt-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            ) : plans.length > 0 ? (
              <div className="space-y-6">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.documentId}
                    plan={plan}
                    strapiUrl={strapiUrl}
                    onUpdate={loadPlans}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">Zatím žádné plány. Vytvořte první obsahový plán výše.</p>
              </div>
            )}
          </div>
        </Container>
      </section>
    </OwnerProtection>
  );
}
