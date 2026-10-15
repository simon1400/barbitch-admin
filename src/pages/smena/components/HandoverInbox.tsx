// «Vzkaz z minulé směny» вверху вкладки «Směna» (s265, §0в плана): сообщение от коллеги — от кого,
// когда, текст, новые и переданные задачи; «Přečteno» (сервер отмечает, только получательнице).
// Непрочитанное — раскрыто и выделено; прочитанное сегодня — свёрнутой строкой («Zobrazit»).
// Задачи открываются во вкладке «Úkoly».
import { useState } from 'react'

import { btnPinkCls, cardPadCls, cardTitleCls, hintCls, mutedCls } from '../../../ui/kit'
import { fmtCsDate, fmtTimePrague, ymdPrague } from '../../../utils/date'
import { readHandover, type Handover } from '../fetch/smena'

const stamp = (iso: string | null) => (iso ? `${fmtCsDate(ymdPrague(iso))} ${fmtTimePrague(iso)}` : '')

function Item({ h, onRead, onOpenTasks }: { h: Handover; onRead: (h: Handover) => void; onOpenTasks: () => void }) {
  const [shown, setShown] = useState(!h.readAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const read = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await readHandover(h.documentId)
      setShown(false)
      onRead(res.handover)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-lg px-3.5 py-3 ${h.readAt ? 'bg-surface-input' : 'bg-warn-bg'}`} data-handover-in={h.documentId} data-read={h.readAt ? '1' : '0'}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="text-[13.5px] font-extrabold text-ink">
          od {h.fromName || '—'} <span className={mutedCls}>· {stamp(h.createdAt)}</span>
        </div>
        {h.readAt && (
          <button type="button" className="text-[12.5px] font-bold text-brand-dark" onClick={() => setShown((v) => !v)} aria-expanded={shown}>
            ✓ přečteno · {shown ? 'Skrýt' : 'Zobrazit'}
          </button>
        )}
      </div>
      {shown && (
        <>
          {h.text && <div className="mt-1.5 text-[14.5px] font-semibold text-ink-body whitespace-pre-line break-words">{h.text}</div>}
          {h.tasks.length > 0 && (
            <ul className="m-0 mt-2 p-0 list-none flex flex-col gap-1">
              {h.tasks.map((t) => (
                <li key={t.documentId}>
                  <button type="button" className="text-left text-[13px] font-bold text-brand-dark hover:underline" onClick={onOpenTasks} data-open-task={t.documentId}>
                    {t.kind === 'new' ? '＋ nový úkol' : '↪ předaný úkol'}: {t.title || '—'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!h.readAt && (
            <button type="button" className={`${btnPinkCls} mt-2.5`} disabled={busy} onClick={() => void read()} data-read-handover>
              {busy ? 'Ukládám…' : 'Přečteno'}
            </button>
          )}
          {error && <div className="mt-1 text-[12px] font-semibold text-neg">{error}</div>}
        </>
      )}
    </div>
  )
}

export function HandoverInbox({ items, onRead, onOpenTasks }: { items: Handover[]; onRead: (h: Handover) => void; onOpenTasks: () => void }) {
  if (!items.length) return null
  const unread = items.filter((h) => !h.readAt).length
  return (
    <section className={`${cardPadCls} ${unread ? '!border-warn-line' : ''}`} data-card="vzkaz" data-testid="smena-vzkaz">
      <h2 className={`${cardTitleCls} mb-1`}>Vzkaz z minulé směny{unread > 1 ? ` · ${unread}` : ''}</h2>
      {unread > 0 && <div className={`${hintCls} mb-2.5`}>Přečtěte a potvrďte — kolegyně uvidí, že jste vzkaz převzala.</div>}
      <div className="flex flex-col gap-2">
        {items.map((h) => (
          <Item key={h.documentId} h={h} onRead={onRead} onOpenTasks={onOpenTasks} />
        ))}
      </div>
    </section>
  )
}
