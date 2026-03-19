import { useState } from 'react';
import type { BlogPlan } from '../../fetch/blogAi';
import { MONTH_NAMES, STATUS_CONFIG, deletePlan } from '../../fetch/blogAi';
import { TopicCard } from './TopicCard';

interface PlanCardProps {
  plan: BlogPlan;
  strapiUrl: string;
  onUpdate: () => void;
}

export function PlanCard({ plan, strapiUrl, onUpdate }: PlanCardProps) {
  const [deleting, setDeleting] = useState(false);
  const status = STATUS_CONFIG[plan.stage] || STATUS_CONFIG.draft;

  const topics = plan.topics || [];
  const proposed = topics.filter(t => t.stage === 'proposed').length;
  const approved = topics.filter(t => t.stage === 'approved').length;
  const generated = topics.filter(t => t.stage === 'generated').length;

  const handleDelete = async () => {
    if (!confirm(`Smazat plán na ${MONTH_NAMES[plan.month]} ${plan.year} a všechna témata?`)) return;
    setDeleting(true);
    try {
      await deletePlan(plan.documentId);
      onUpdate();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Plan header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-md md:text-md font-bold text-gray-800">
            {MONTH_NAMES[plan.month]} {plan.year}
          </h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
            {status.label}
          </span>
          <span className="text-xs text-gray-500">
            {proposed > 0 && `${proposed} ke schválení`}
            {approved > 0 && ` · ${approved} schváleno`}
            {generated > 0 && ` · ${generated} vygenerováno`}
          </span>
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
        >
          {deleting ? '...' : 'Smazat'}
        </button>
      </div>

      {/* Topics grid */}
      {topics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topics
            .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''))
            .map((topic) => (
              <TopicCard
                key={topic.documentId}
                topic={topic}
                strapiUrl={strapiUrl}
                onUpdate={onUpdate}
              />
            ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Žádná témata v tomto plánu.</p>
      )}
    </div>
  );
}
