import type { PublishFailure } from '../../fetch/shiftClose'
import { StatSection } from '../StatSection'
import { fmt } from './helpers'

interface PublishSectionProps {
  cardSum: string
  setCardSum: (v: string) => void
  publishing: boolean
  published: boolean
  publishError: string | null
  publishFailures?: PublishFailure[]
  profitDelta: {
    before: number
    after: number
    diffBefore: number
    diffAfter: number
  } | null
  onPublish: () => void
}

export const PublishSection = ({
  cardSum,
  setCardSum,
  publishing,
  published,
  publishError,
  publishFailures = [],
  profitDelta,
  onPublish,
}: PublishSectionProps) => (
  <StatSection title="Uzavření směny" id="card-profit" defaultOpen>
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Doход na kartu (Kč)
          </label>
          <input
            type="number"
            value={cardSum}
            onChange={(e) => setCardSum(e.target.value)}
            placeholder="0"
            min="0"
            disabled={published}
            className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:bg-gray-100"
          />
        </div>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing || published || !cardSum}
          className={`px-8 py-2.5 font-bold rounded-lg transition-colors text-white ${
            published
              ? 'bg-green-500 cursor-default'
              : 'bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {publishing ? 'Publikuji...' : published ? 'Směna uzavřena' : 'Uzavřít směnu'}
        </button>
      </div>

      {publishError && (
        <p className="text-sm text-red-600 font-medium mt-3">{publishError}</p>
      )}

      {publishFailures.length > 0 && (
        <div className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800 mb-2">
            Záznamy, které se nepodařilo publikovat ({publishFailures.length}):
          </p>
          <ul className="space-y-2">
            {publishFailures.map((f, i) => (
              <li
                key={i}
                className="text-sm bg-white border border-red-200 rounded-lg p-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                    {f.collection}
                  </span>
                  <span className="font-semibold text-gray-800">{f.label}</span>
                </div>
                <p className="text-xs text-red-700 mt-1.5 font-mono break-words">
                  {f.message}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-600 mt-3">
            Opravte tyto záznamy v Strapi (vyplňte chybějící povinná pole) a klikněte na <b>Uzavřít směnu</b> znovu.
          </p>
        </div>
      )}

      {published && profitDelta && (
        <div className="mt-5 rounded-xl border-2 border-green-200 bg-green-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Čistý zisk směny</p>
              <p
                className={`text-3xl font-bold ${
                  profitDelta.after - profitDelta.before >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {profitDelta.after - profitDelta.before >= 0 ? '+' : ''}
                {fmt(profitDelta.after - profitDelta.before)} Kč
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Rezultát za měsíc</p>
              <p className="text-sm text-gray-500">
                {fmt(profitDelta.before)} →{' '}
                <span className="font-semibold text-gray-800">
                  {fmt(profitDelta.after)} Kč
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {published && profitDelta && (() => {
        const shiftDiff = profitDelta.diffAfter - profitDelta.diffBefore
        const ok = shiftDiff === 0
        return (
          <div
            className={`mt-4 rounded-xl border-2 p-5 ${
              ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Rozdíl proti minulé směně (nedostatek)
                </p>
                <p
                  className={`text-3xl font-bold ${
                    ok ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {ok
                    ? '✓ Sedí (0 Kč)'
                    : `${shiftDiff > 0 ? '+' : ''}${fmt(shiftDiff)} Kč`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Celkový rozdíl za měsíc</p>
                <p className="text-sm text-gray-500">
                  {fmt(profitDelta.diffBefore)} →{' '}
                  <span
                    className={`font-semibold ${
                      profitDelta.diffAfter === 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {fmt(profitDelta.diffAfter)} Kč
                  </span>
                </p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  </StatSection>
)
