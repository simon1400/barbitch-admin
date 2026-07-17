import { useState, useEffect, useCallback, useRef } from 'react'
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
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Priorita masterů (Kdokoliv)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Při výběru "Kdokoliv" systém automaticky vybere nejméně vytíženého mastera
          (podle počtu rezervací v okolí daného dne). Priorita je ruční "bonus":
          vyšší číslo = master dostává rezervace častěji i při mírně vyšší vytíženosti.
          Nech všem 0 pro čistě rovnoměrné rozdělení.
        </p>
      </div>

      {loading ? (
        <div className="text-gray-500">Načítání...</div>
      ) : masters.length === 0 ? (
        <div className="text-gray-500">Žádní masteři nenalezeni.</div>
      ) : (
        <div className="grid gap-4">
          {masters.map((master) => (
            <div
              key={master.documentId}
              className={`bg-white rounded-lg p-5 shadow-sm border flex items-center gap-4 ${saving === master.documentId ? 'animate-pulse' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-800">{master.name}</span>
                {master.noonaEmployeeId ? (
                  <p className="text-xs text-gray-400 mt-0.5">ID: {master.noonaEmployeeId}</p>
                ) : (
                  <p className="text-xs text-red-500 mt-0.5">
                    Chybí interní ID mistra — mistr se nezobrazí v kalendáři!
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">Priorita:</label>
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
                  className="w-16 px-2 py-1.5 border rounded text-center text-sm"
                  disabled={saving === master.documentId}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
        <p className="font-semibold mb-1">Jak to funguje:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Když klient vybere "Kdokoliv", systém spočítá vytíženost každého dostupného mastera (počet rezervací ±3 dny kolem vybraného dne)</li>
          <li>Rezervaci dostane nejméně vytížený master → práce se rozkládá rovnoměrně</li>
          <li>Priorita funguje jako bonus: každý bod sníží "efektivní vytíženost" mastera, takže ho systém volí častěji (ruční preference konkrétního mastera)</li>
          <li>Při stejné efektivní vytíženosti se vybere náhodně</li>
          <li>Pokud je na daný čas dostupný pouze jeden master, vybere se automaticky</li>
        </ul>
      </div>
    </>
  )
}
