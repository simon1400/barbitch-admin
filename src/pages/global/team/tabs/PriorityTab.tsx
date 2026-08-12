import { useState, useEffect, useCallback, useRef } from 'react'
import {
  cardPadCls,
  cardTitleCls,
  hintCls,
  inputBaseCls,
  pinkCardCls,
  pinkCardTitleCls,
} from '../../../../ui/kit'
import type { MasterPriorityData } from '../../fetch/masterPriority'
import { fetchMasters, updateMasterPriority } from '../../fetch/masterPriority'

export default function PriorityTab() {
  const [masters, setMasters] = useState<MasterPriorityData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const originalPriority = useRef<number>(0)

  const loadMasters = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchMasters()
      setMasters(data.sort((a, b) => b.bookingPriority - a.bookingPriority))
    } catch {
      setMasters([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMasters()
  }, [loadMasters])

  const handlePriorityChange = async (master: MasterPriorityData, newPriority: number) => {
    setSaving(master.documentId)
    try {
      await updateMasterPriority(master.documentId, { bookingPriority: newPriority })
      setMasters((prev) =>
        prev
          .map((m) => (m.documentId === master.documentId ? { ...m, bookingPriority: newPriority } : m))
          .sort((a, b) => b.bookingPriority - a.bookingPriority),
      )
    } catch (err: unknown) {
      alert(`Chyba: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <div className={cardPadCls}>
        <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-x-7 gap-y-[18px]">
          <div>
            <h2 className={`${cardTitleCls} mb-1.5`}>Priorita masterů (Kdokoliv)</h2>
            <p className={`m-0 ${hintCls}`}>
              Vyšší číslo = master dostává rezervace častěji. Nech všem 0 pro rovnoměrné
              rozdělení.
            </p>
          </div>

          <div>
            <p className="m-0 mb-3 text-[13px] leading-[1.6] font-medium text-ink-muted">
              Při výběru "Kdokoliv" systém automaticky vybere nejméně vytíženého mastera
              (podle počtu rezervací v okolí daného dne). Priorita je ruční "bonus": vyšší
              číslo = master dostává rezervace častěji i při mírně vyšší vytíženosti.
            </p>

            {loading ? (
              <div className="py-8 text-[13px] font-semibold text-ink-faint">Načítání...</div>
            ) : masters.length === 0 ? (
              <div className="py-8 text-[13px] font-semibold text-ink-faint">
                Žádní masteři nenalezeni.
              </div>
            ) : (
              masters.map((master, idx) => (
                <div
                  key={master.documentId}
                  className={`flex items-center justify-between gap-3.5 py-[11px] ${
                    idx > 0 ? 'border-t border-line-soft' : ''
                  } ${saving === master.documentId ? 'animate-pulse' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-ink">{master.name}</div>
                    {master.noonaEmployeeId ? (
                      <div className="mt-0.5 font-mono text-[11px] text-ink-label">
                        ID: {master.noonaEmployeeId}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[11px] font-semibold text-neg">
                        Chybí interní ID mistra — mistr se nezobrazí v kalendáři!
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-ink-soft">
                      Priorita
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={master.bookingPriority}
                      onFocus={() => {
                        originalPriority.current = master.bookingPriority
                      }}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                        setMasters((prev) =>
                          prev.map((m) =>
                            m.documentId === master.documentId ? { ...m, bookingPriority: val } : m,
                          ),
                        )
                      }}
                      onBlur={(e) => {
                        const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                        if (val !== originalPriority.current) {
                          handlePriorityChange(master, val)
                        }
                      }}
                      className={`${inputBaseCls} w-[60px] rounded-lg px-2.5 py-2 text-[14px] font-bold text-center`}
                      disabled={saving === master.documentId}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={pinkCardCls}>
        <div className={pinkCardTitleCls}>Jak to funguje</div>
        <ul className="m-0 pl-[18px] grid gap-1.5">
          {[
            'Když klient vybere "Kdokoliv", systém spočítá vytíženost každého dostupného mastera (počet rezervací ±3 dny kolem vybraného dne)',
            'Rezervaci dostane nejméně vytížený master → práce se rozkládá rovnoměrně',
            'Priorita funguje jako bonus: každý bod sníží "efektivní vytíženost" mastera, takže ho systém volí častěji (ruční preference konkrétního mastera)',
            'Při stejné efektivní vytíženosti se vybere náhodně',
            'Pokud je na daný čas dostupný pouze jeden master, vybere se automaticky',
          ].map((line) => (
            <li key={line} className="text-[12.5px] leading-[1.55] font-medium text-ink-muted">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
