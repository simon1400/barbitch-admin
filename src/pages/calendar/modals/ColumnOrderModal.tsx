// Порядок колонок мастеров в календаре (personal.calendarOrder, общий для всех админов)

import { useState } from 'react'
import type { CalendarEmployee } from '../fetch/calendarDay'
import { saveEmployeesOrder } from '../fetch/calendarDay'
import { ModalShell } from './ui'

export const ColumnOrderModal = ({
  employees,
  onClose,
  onSaved,
}: {
  employees: CalendarEmployee[]
  onClose: () => void
  onSaved: () => void
}) => {
  const [list, setList] = useState<CalendarEmployee[]>(employees)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setList(next)
  }

  const changed = list.some((e, i) => e.docId !== employees[i]?.docId)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      // шаг 10 — чтобы потом можно было вручную «вставить между» через Strapi CM
      await saveEmployeesOrder(list.map((e, i) => ({ docId: e.docId, order: (i + 1) * 10 })))
      onSaved()
    } catch (e) {
      setError((e as Error).message || 'Uložení se nepodařilo')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Pořadí mistrů" onClose={onClose}>
      <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
        Pořadí sloupců v kalendáři (zleva doprava). Platí pro všechny administrátory.
      </p>
      <div className="space-y-1.5">
        {list.map((e, i) => (
          <div
            key={e.docId}
            className="flex items-center justify-between rounded-md border border-gray-200 dark:border-[#2e2e2c] bg-white dark:bg-[#2a2a28] px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-300">
              <span className="w-5 text-right text-xs text-gray-400 dark:text-gray-500">{i + 1}.</span>
              {e.name}
              {e.tier === 'junior' && (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                  junior
                </span>
              )}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                disabled={i === 0 || saving}
                onClick={() => move(i, -1)}
                className="rounded border border-gray-300 dark:border-[#3f3f3d] px-2 py-0.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333331] disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === list.length - 1 || saving}
                onClick={() => move(i, 1)}
                className="rounded border border-gray-300 dark:border-[#3f3f3d] px-2 py-0.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333331] disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 dark:border-[#3f3f3d] px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333331]"
        >
          Zavřít
        </button>
        <button
          type="button"
          disabled={!changed || saving}
          onClick={save}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Ukládám…' : 'Uložit pořadí'}
        </button>
      </div>
    </ModalShell>
  )
}
