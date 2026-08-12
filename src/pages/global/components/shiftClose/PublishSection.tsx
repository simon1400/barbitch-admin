import type { PublishFailure, RevertResult, ShiftDelta } from '../../fetch/shiftClose'
import { StatSection } from '../StatSection'
import { fmt } from './helpers'

// The two result boxes — reused for the post-close result and for the (unsaved) preview.
const ProfitDeltaBoxes = ({ delta, preview }: { delta: ShiftDelta; preview: boolean }) => {
  const shiftDiff = delta.diffAfter - delta.diffBefore
  const ok = shiftDiff === 0
  return (
    <>
      <div
        className={`mt-5 rounded-xl border-2 p-5 ${
          preview ? 'border-indigo-200 bg-indigo-50' : 'border-pos-line bg-pos-bg'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-muted">
              Čistý zisk směny{preview ? ' (náhled — neuloženo)' : ''}
            </p>
            <p
              className={`text-3xl font-bold ${
                delta.after - delta.before >= 0 ? 'text-pos' : 'text-neg'
              }`}
            >
              {delta.after - delta.before >= 0 ? '+' : ''}
              {fmt(delta.after - delta.before)} Kč
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-soft">Rezultát za měsíc</p>
            <p className="text-sm text-ink-soft">
              {fmt(delta.before)} →{' '}
              <span className="font-semibold text-ink">{fmt(delta.after)} Kč</span>
            </p>
          </div>
        </div>
      </div>

      <div
        className={`mt-4 rounded-xl border-2 p-5 ${
          ok ? 'border-pos-line bg-pos-bg' : 'border-neg-line bg-neg-bg'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-muted">Rozdíl proti minulé směně (nedostatek)</p>
            <p className={`text-3xl font-bold ${ok ? 'text-pos' : 'text-neg'}`}>
              {ok ? '✓ Sedí (0 Kč)' : `${shiftDiff > 0 ? '+' : ''}${fmt(shiftDiff)} Kč`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-soft">Celkový rozdíl za měsíc</p>
            <p className="text-sm text-ink-soft">
              {fmt(delta.diffBefore)} →{' '}
              <span
                className={`font-semibold ${
                  delta.diffAfter === 0 ? 'text-pos' : 'text-neg'
                }`}
              >
                {fmt(delta.diffAfter)} Kč
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

interface PublishSectionProps {
  cardSum: string
  setCardSum: (v: string) => void
  extraIncome: string
  setExtraIncome: (v: string) => void
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
  reverting: boolean
  revertResult: RevertResult | null
  revertError: string | null
  onRevert: () => void
  previewing: boolean
  previewDelta: ShiftDelta | null
  previewError: string | null
  onPreview: () => void
}

const REVERT_LABELS: Record<string, string> = {
  cashs: 'Pokladna',
  'services-provided': 'Provedené služby',
  'work-times': 'Pracovní doba',
  payrolls: 'Výplaty',
}

export const PublishSection = ({
  cardSum,
  setCardSum,
  extraIncome,
  setExtraIncome,
  publishing,
  published,
  publishError,
  publishFailures = [],
  profitDelta,
  onPublish,
  reverting,
  revertResult,
  revertError,
  onRevert,
  previewing,
  previewDelta,
  previewError,
  onPreview,
}: PublishSectionProps) => (
  <StatSection title="Uzavření směny" id="card-profit" defaultOpen>
    <div className="bg-white rounded-xl border border-line p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-muted mb-1">
            Doход na kartu (Kč)
          </label>
          <input
            type="number"
            value={cardSum}
            onChange={(e) => setCardSum(e.target.value)}
            placeholder="0"
            min="0"
            disabled={published}
            className="border border-line-btn rounded-lg px-4 py-2.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:bg-line-soft"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-muted mb-1">
            Extra příjem (Kč)
          </label>
          <input
            type="number"
            value={extraIncome}
            onChange={(e) => setExtraIncome(e.target.value)}
            placeholder="0"
            min="0"
            disabled={published}
            className="border border-line-btn rounded-lg px-4 py-2.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:bg-line-soft"
          />
        </div>
        <button
          type="button"
          onClick={onPreview}
          disabled={previewing || publishing || published}
          title="Spočítá výsledek směny se zadanými hodnotami — nic se neukládá"
          className="px-6 py-2.5 font-semibold rounded-lg border-2 border-indigo-400 text-indigo-700 bg-white hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {previewing ? 'Počítám...' : 'Náhled výsledku'}
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing || published || !cardSum}
          className={`px-8 py-2.5 font-bold rounded-lg transition-colors text-white ${
            published
              ? 'bg-pos-bg0 cursor-default'
              : 'bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {publishing ? 'Publikuji...' : published ? 'Směna uzavřena' : 'Uzavřít směnu'}
        </button>
        <button
          type="button"
          onClick={onRevert}
          disabled={reverting || publishing}
          title="Vrátí všechny publikované záznamy tohoto dne zpět do konceptu (nic nemaže)"
          className="px-6 py-2.5 font-semibold rounded-lg border-2 border-amber-400 text-warn bg-white hover:bg-warn-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reverting ? 'Vracím...' : 'Vrátit uzavření'}
        </button>
      </div>
      <p className="text-xs text-ink-soft mt-2">
        „Vrátit uzavření" zruší publikaci záznamů toho dne (vrátí je do konceptu) — data
        zůstanou, nic se nesmaže. Poté je můžete upravit a směnu znovu uzavřít.
      </p>

      {revertError && (
        <p className="text-sm text-neg font-medium mt-3">{revertError}</p>
      )}

      {revertResult && (
        <div className="mt-4 rounded-xl border-2 border-amber-200 bg-warn-bg p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            Uzavření vráceno — záznamy jsou opět koncepty:
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(revertResult.unpublished).map(([key, n]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-white border border-amber-200 text-amber-800"
              >
                {REVERT_LABELS[key] || key}: <b>{n}</b>
              </span>
            ))}
            {revertResult.vouchersReverted > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-white border border-pink-200 text-pink-800">
                Vouchery (dateRealized zrušeno): <b>{revertResult.vouchersReverted}</b>
              </span>
            )}
            {revertResult.cardProfitReset && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-white border border-amber-200 text-amber-800">
                Doход na kartu obnoven na předchozí hodnotu
              </span>
            )}
          </div>
          {revertResult.errors.length > 0 && (
            <ul className="mt-3 space-y-1">
              {revertResult.errors.map((e, i) => (
                <li key={i} className="text-xs text-neg font-mono break-words">
                  {e}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted mt-3">
            Upravte záznamy ve Strapi a klikněte na <b>Zkontrolovat</b> a poté <b>Uzavřít směnu</b>.
          </p>
        </div>
      )}

      {publishError && (
        <p className="text-sm text-neg font-medium mt-3">{publishError}</p>
      )}

      {publishFailures.length > 0 && (
        <div className="mt-4 rounded-xl border-2 border-neg-line bg-neg-bg p-4">
          <p className="text-sm font-semibold text-red-800 mb-2">
            Záznamy, které se nepodařilo publikovat ({publishFailures.length}):
          </p>
          <ul className="space-y-2">
            {publishFailures.map((f, i) => (
              <li
                key={i}
                className="text-sm bg-white border border-neg-line rounded-lg p-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-neg">
                    {f.collection}
                  </span>
                  <span className="font-semibold text-ink">{f.label}</span>
                </div>
                <p className="text-xs text-neg mt-1.5 font-mono break-words">
                  {f.message}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted mt-3">
            Opravte tyto záznamy v Strapi (vyplňte chybějící povinná pole) a klikněte na <b>Uzavřít směnu</b> znovu.
          </p>
        </div>
      )}

      {previewError && (
        <p className="text-sm text-neg font-medium mt-3">{previewError}</p>
      )}

      {/* Preview (unsaved) — hidden once the shift is actually closed. */}
      {!published && previewDelta && <ProfitDeltaBoxes delta={previewDelta} preview />}

      {/* Real result after closing the shift. */}
      {published && profitDelta && <ProfitDeltaBoxes delta={profitDelta} preview={false} />}
    </div>
  </StatSection>
)
