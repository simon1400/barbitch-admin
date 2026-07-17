// Управление существующим блоком (клик по серому блоку в гриде): правка
// времени/названия этого конкретного блока, удаление одного или всей серии.

import { useEffect, useState } from 'react'
import type { BlockedRange } from '../fetch/calendarDay'
import { engineDeleteBlock, enginePatchBlock, fetchBlockSeriesCount } from '../fetch/engineApi'
import { blokPlural, fmtHM, inputCls, labelCls, toMin } from './helpers'
import { ModalShell, Section, TimeSelect } from './ui'

interface EditBlockProps {
  block: BlockedRange
  masterName: string
  date: string
  onClose: () => void
  onChanged: () => void
}

export const EditBlockModal = ({ block, masterName, date, onClose, onChanged }: EditBlockProps) => {
  const [fromTime, setFromTime] = useState(fmtHM(block.startMin))
  const [toTime, setToTime] = useState(fmtHM(block.endMin))
  const [title, setTitle] = useState(block.title || '')
  const [seriesCount, setSeriesCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // сколько повторений в серии (для кнопки «smazat celou sérii»)
  useEffect(() => {
    fetchBlockSeriesCount(block).then(setSeriesCount)
  }, [block])

  const timeValid = /^\d{2}:\d{2}$/.test(fromTime) && /^\d{2}:\d{2}$/.test(toTime) && toMin(toTime) > toMin(fromTime)
  const dirty =
    toMin(fromTime) !== block.startMin || toMin(toTime) !== block.endMin || title.trim() !== (block.title || '')

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const save = () => {
    if (!timeValid || !block.documentId) return
    run(() =>
      enginePatchBlock(block.documentId!, { startMin: toMin(fromTime), endMin: toMin(toTime), title: title.trim() }),
    )
  }
  const removeOne = () => {
    if (!block.documentId) return
    if (!window.confirm(`Smazat blok ${block.title || ''} ${fmtHM(block.startMin)}–${fmtHM(block.endMin)} (${masterName})?`)) return
    run(() => engineDeleteBlock(block.documentId!))
  }
  const removeSeries = () => {
    if (!block.documentId) return
    if (!window.confirm(`Smazat celou sérii — ${seriesCount} ${blokPlural(seriesCount)} (${masterName})?`)) return
    run(() => engineDeleteBlock(block.documentId!, true))
  }

  return (
    <ModalShell title="Blok" onClose={onClose}>
      <div className="space-y-4">
        {/* инфо-шапка */}
        <div className="rounded-lg bg-gray-50 dark:bg-[#2a2a28] px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
          <b>{masterName}</b> · {date}
          {seriesCount > 1 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Součást série — celkem {seriesCount} {blokPlural(seriesCount)}.</p>
          )}
        </div>

        {/* правка этого конкретного блока */}
        <Section title="Upravit tento blok">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className={labelCls}>Od</span>
              <TimeSelect value={fromTime} onChange={setFromTime} />
            </div>
            <div>
              <span className={labelCls}>Do</span>
              <TimeSelect value={toTime} onChange={setToTime} />
            </div>
          </div>
          <div>
            <span className={labelCls}>Důvod</span>
            <input className={inputCls} placeholder="školení / dovolená / oběd…" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <button
            type="button"
            disabled={!timeValid || !dirty || busy}
            onClick={save}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Uložit změny
          </button>
        </Section>

        {/* удаление */}
        <Section title="Smazání">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={removeOne}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
            >
              Smazat tento blok
            </button>
            {seriesCount > 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={removeSeries}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
              >
                Smazat celou sérii ({seriesCount})
              </button>
            )}
          </div>
        </Section>

        {error && <p className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100">
            Zavřít
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
