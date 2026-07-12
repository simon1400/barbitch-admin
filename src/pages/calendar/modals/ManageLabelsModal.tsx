// «Spravovat štítky» — справочник кастомных лейблов броней (как stavy в Noona):
// добавить (имя + палитра), rename инлайн (onBlur), смена цвета, удаление.
// Удаление лейбла из справочника уже проставленные брони не трогает (снапшот).

import { useEffect, useState } from 'react'
import {
  LABEL_COLORS,
  createBookingLabel,
  deleteBookingLabel,
  fetchBookingLabels,
  updateBookingLabel,
  type BookingLabel,
} from '../fetch/bookingLabels'
import { inputCls } from './helpers'
import { ModalShell, Section } from './ui'

const ColorPicker = ({ value, onPick }: { value: string; onPick: (c: string) => void }) => (
  <span className="flex items-center gap-1">
    {LABEL_COLORS.map((c) => (
      <button
        key={c}
        type="button"
        onClick={() => onPick(c)}
        className={`h-5 w-5 rounded-full border-2 transition ${
          value === c ? 'scale-110 border-gray-700' : 'border-transparent hover:scale-105'
        }`}
        style={{ background: c }}
        title={c}
      />
    ))}
  </span>
)

export const ManageLabelsModal = ({ onClose }: { onClose: () => void }) => {
  const [labels, setLabels] = useState<BookingLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [names, setNames] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(LABEL_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    fetchBookingLabels()
      .then((ls) => {
        setLabels(ls)
        setNames(Object.fromEntries(ls.map((l) => [l.documentId, l.name])))
      })
      .finally(() => setLoading(false))
  useEffect(() => {
    load()
  }, [])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const name = newName.trim()
    if (!name) return
    run(async () => {
      await createBookingLabel(name, newColor, labels.length)
      setNewName('')
    })
  }

  return (
    <ModalShell title="Spravovat štítky" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          Štítky se přiřazují rezervacím v detailu. Smazání štítku z tohoto seznamu už přiřazené
          rezervace nemění.
        </p>

        {loading ? (
          <p className="text-sm text-gray-500">Načítám…</p>
        ) : (
          <div className="space-y-2">
            {labels.map((l) => (
              <div key={l.documentId} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5">
                <input
                  className="min-w-0 flex-1 rounded border border-transparent px-1.5 py-0.5 text-sm text-gray-800 hover:border-gray-200 focus:border-gray-300 focus:outline-none"
                  value={names[l.documentId] ?? l.name}
                  disabled={busy}
                  onChange={(e) => setNames((cur) => ({ ...cur, [l.documentId]: e.target.value }))}
                  onBlur={() => {
                    const name = (names[l.documentId] ?? '').trim()
                    if (name && name !== l.name) run(() => updateBookingLabel(l.documentId, { name }))
                  }}
                />
                <ColorPicker
                  value={l.color}
                  onPick={(color) => color !== l.color && !busy && run(() => updateBookingLabel(l.documentId, { color }))}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Smazat štítek „${l.name}“?`)) run(() => deleteBookingLabel(l.documentId))
                  }}
                  className="ml-1 text-gray-400 hover:text-red-600 disabled:opacity-40"
                  title="Smazat štítek"
                >
                  ✕
                </button>
              </div>
            ))}
            {labels.length === 0 && <p className="text-sm text-gray-400">Zatím žádné štítky.</p>}
          </div>
        )}

        {/* новый лейбл */}
        <Section title="Nový štítek">
          <div className="flex items-center gap-2">
            <input
              className={`${inputCls} flex-1`}
              placeholder="Název (např. Dorazil/a)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <ColorPicker value={newColor} onPick={setNewColor} />
            <button
              type="button"
              disabled={busy || !newName.trim()}
              onClick={add}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Přidat
            </button>
          </div>
        </Section>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Zavřít
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
