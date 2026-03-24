import { useState, useEffect, useCallback, useRef } from 'react'
import { Container } from '../../components/Container'
import { OwnerProtection } from './components/OwnerProtection'
import type { MasterPriorityData } from './fetch/masterPriority'
import { fetchMasters, updateMasterPriority } from './fetch/masterPriority'

export default function MasterPriorityPage() {
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
    <OwnerProtection>
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          <div className="mt-8 mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Priorita masterů (Kdokoliv)</h1>
            <p className="text-sm text-gray-500 mt-1">
              Nastavení priority masterů při výběru "Kdokoliv" v rezervaci.
              Vyšší číslo = vyšší priorita. Při stejné prioritě se vybere náhodně.
            </p>
          </div>

          {loading ? (
            <div className="text-gray-500">Načítání...</div>
          ) : masters.length === 0 ? (
            <div className="text-gray-500">Žádní masteri nenalezeni.</div>
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
                      <p className="text-xs text-gray-400 mt-0.5">Noona ID: {master.noonaEmployeeId}</p>
                    ) : (
                      <p className="text-xs text-red-500 mt-0.5">Chybí Noona ID — priorita nebude fungovat!</p>
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
              <li>Když klient vybere "Kdokoliv", systém vybere mastera s nejvyšší prioritou</li>
              <li>Pokud mají stejnou prioritu, vybere se náhodně mezi nimi</li>
              <li>Pokud je na daný čas dostupný pouze jeden master, vybere se automaticky</li>
            </ul>
          </div>
        </Container>
      </section>
    </OwnerProtection>
  )
}
