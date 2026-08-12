import { useState, useEffect, useCallback } from 'react';
import { h1Cls, kickerCls, pageShellCls } from '../../ui/kit';
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
      <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>Blog AI</h1>

        <PlanGenerator onGenerated={loadPlans} />

        {loading ? (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a39e99]">
            Načítání…
          </div>
        ) : plans.length > 0 ? (
          <div className="grid gap-3.5">
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
          <div className="py-12 text-center text-[13px] font-semibold text-[#a39e99]">
            Zatím žádné plány. Vytvořte první obsahový plán výše.
          </div>
        )}
      </div>
    </OwnerProtection>
  );
}
