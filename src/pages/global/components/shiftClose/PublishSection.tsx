import { StatSection } from '../StatSection'
import { fmt } from './helpers'

interface PublishSectionProps {
  cardSum: string
  setCardSum: (v: string) => void
  publishing: boolean
  published: boolean
  publishError: string | null
  profitDelta: { before: number; after: number } | null
  onPublish: () => void
}

export const PublishSection = ({
  cardSum,
  setCardSum,
  publishing,
  published,
  publishError,
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
    </div>
  </StatSection>
)
