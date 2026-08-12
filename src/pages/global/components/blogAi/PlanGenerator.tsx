/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { generatePlan, MONTH_NAMES } from '../../fetch/blogAi';

interface PlanGeneratorProps {
  onGenerated: () => void;
}

export function PlanGenerator({ onGenerated }: PlanGeneratorProps) {
  const now = new Date();
  const nextMonth = now.getMonth() + 2;
  const defaultMonth = nextMonth > 12 ? nextMonth - 12 : nextMonth;
  const defaultYear = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();

  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      await generatePlan(month, year);
      onGenerated();
    } catch (err: any) {
      setError(err?.message || 'Chyba při generování plánu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-line p-5 shadow-sm">
      <h2 className="m-0 mb-1.5 text-[15px] font-extrabold text-ink">Nový obsahový plán</h2>
      <p className="text-xs font-semibold text-ink-soft mb-4">
        AI analyzuje stávající blog, vyhodnotí sezónnost a navrhne 4 témata.
      </p>

      <div className="flex items-end gap-3">
        <div>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-line-btn rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
            disabled={loading}
          >
            {MONTH_NAMES.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-line-btn rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
            disabled={loading}
          >
            {[now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-6 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analyzuji...
            </span>
          ) : (
            'Generovat plán'
          )}
        </button>
      </div>

      {error && (
        <p className="text-sm text-neg font-medium mt-3">{error}</p>
      )}
    </div>
  );
}
