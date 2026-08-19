// Управление существующим блоком (клик по серому блоку в гриде): правка
// времени/названия этого конкретного блока, удаление одного или всей серии.

import { useEffect, useState } from 'react'
import type { BlockedRange } from '../fetch/calendarDay'
import {
  engineDeleteBlock,
  enginePatchBlock,
  engineSetBlockApproval,
  fetchBlockSeriesCount,
} from '../fetch/engineApi'
import { blokPlural, fmtHM, inputCls, labelCls, toMin } from './helpers'
import { ModalShell, Section, TimeSelect } from './ui'

interface EditBlockProps {
  block: BlockedRange
  masterName: string
  date: string
  // владелец подтверждает/отклоняет блоки администраторов (у остальных ролей — только статус)
  isOwner: boolean
  onClose: () => void
  onChanged: () => void
}

// Когда и кем заведён блок: own-блоки движка несут createdByName (имя админа из сессии),
// старые own-блоки (до этой правки) — только дату, зеркальные Noona — дату импорта.
const blockCreatedLabel = (block: BlockedRange): string | null => {
  const parts: string[] = []
  if (block.createdAt) {
    const d = new Date(block.createdAt)
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      )
    }
  }
  if (block.createdByName) parts.push(block.createdByName)
  else if (block.own) parts.push('kalendář (admin)')
  else parts.push('import Noona')
  return parts.length ? parts.join(' · ') : null
}

export const EditBlockModal = ({ block, masterName, date, isOwner, onClose, onChanged }: EditBlockProps) => {
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
  // легаси-блоки (заведены до подтверждений) и зеркальные Noona-блоки поля не имеют → approved
  const approval = block.approval || 'approved'

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
  const approve = (series: boolean) => {
    if (!block.documentId) return
    run(() => engineSetBlockApproval(block.documentId!, 'approved', series))
  }
  const reject = (series: boolean) => {
    if (!block.documentId) return
    if (
      !window.confirm(
        series
          ? `Zamítnout celou sérii — ${seriesCount} ${blokPlural(seriesCount)} (${masterName})?`
          : `Zamítnout blok ${fmtHM(block.startMin)}–${fmtHM(block.endMin)} (${masterName})?`,
      )
    )
      return
    run(() => engineSetBlockApproval(block.documentId!, 'rejected', series))
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
          {approval === 'approved' && block.approvedByName && (
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              <span className="font-semibold">Schváleno:</span> {block.approvedByName}
            </p>
          )}
          {blockCreatedLabel(block) && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Vytvořeno:</span> {blockCreatedLabel(block)}
            </p>
          )}
        </div>

        {/* подтверждение владельцем: до него блок термин НЕ занимает */}
        {approval !== 'approved' && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              approval === 'pending'
                ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
            }`}
          >
            <b>{approval === 'pending' ? 'Čeká na schválení majitele' : 'Zamítnuto majitelem'}</b>
            <p className="mt-1 text-xs">
              {approval === 'pending'
                ? 'Dokud majitel blok neschválí, termín se neblokuje — klienti si ho můžou zarezervovat.'
                : 'Blok termín neblokuje. Upravte ho (půjde znovu ke schválení), nebo ho smažte.'}
            </p>
            {approval === 'rejected' && block.approvedByName && (
              <p className="mt-1 text-xs opacity-80">Zamítl/a: {block.approvedByName}</p>
            )}
          </div>
        )}

        {isOwner && approval !== 'approved' && (
          <Section title="Schválení">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => approve(false)}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Schválit tento blok
              </button>
              {seriesCount > 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => approve(true)}
                  className="rounded-md border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-40"
                >
                  Schválit celou sérii ({seriesCount})
                </button>
              )}
              {approval === 'pending' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => reject(seriesCount > 1)}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
                >
                  Zamítnout{seriesCount > 1 ? ` (celou sérii ${seriesCount})` : ''}
                </button>
              )}
            </div>
          </Section>
        )}

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
