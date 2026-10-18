// Карточка «O klientce» в шторке брони (s267): заметка о клиентке, общая на все
// её брони — «velmi husté řasy», «alergie na lepidlo X». В отличие от «Poznámka»
// (заметка ОДНОЙ брони) переходит с визита на визит.
//
// Админ/управляющая/владелец — правят (ручка client-dedupe, журнал календаря
// пишет сервер). Мастер (readOnly) — только читает, и сервер отдаёт ему заметку
// лишь у СВОИХ броней. У брони без связанного клиента (старый импорт, интерная)
// сохранять некуда — карточки нет.
//
// Рендерить с key=documentId брони: шторка между бронями не размонтируется,
// а черновик не должен переехать к другой клиентке.
import { useEffect, useRef, useState } from 'react'
import type { CalendarBooking } from '../fetch/calendarDay'
import { CLIENT_NOTE_MAX } from '../../../lib/clientNote'

interface Props {
  b: CalendarBooking
  busy: boolean
  readOnly: boolean
  onSave: (note: string) => void
}

const titleCls = 'text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300'

export const ClientNoteCard = ({ b, busy, readOnly, onSave }: Props) => {
  const saved = b.clientNote || ''
  const [draft, setDraft] = useState(saved)
  const changed = draft.trim() !== saved.trim()
  const ref = useRef<HTMLTextAreaElement | null>(null)

  // авто-высота: растёт под текст (кап 200px), пустая — в одну строку
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, 200)}px`
  }, [draft])

  if (readOnly) {
    if (!saved) return null
    return (
      <div data-client-note className="mt-3 rounded-xl border border-violet-300 bg-violet-50 p-3 dark:border-violet-500/40 dark:bg-violet-500/10">
        <div className={titleCls}>O klientce</div>
        <div className="mt-1 whitespace-pre-line text-sm text-gray-800 dark:text-gray-200">{saved}</div>
      </div>
    )
  }

  if (!b.client?.documentId) return null

  return (
    <div
      data-client-note
      className={`mt-3 rounded-xl border p-3 ${
        saved
          ? 'border-violet-300 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-500/10'
          : 'border-gray-400 dark:border-[#2e2e2c]'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={titleCls}>O klientce</span>
        {changed && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(draft.trim())}
            className="rounded-md border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 disabled:opacity-40 dark:border-violet-500/50 dark:bg-transparent dark:text-violet-300 dark:shadow-none dark:hover:bg-violet-500/10 sm:px-2.5 sm:py-1"
          >
            Uložit
          </button>
        )}
      </div>
      <textarea
        ref={ref}
        value={draft}
        maxLength={CLIENT_NOTE_MAX}
        onChange={(e) => setDraft(e.target.value)}
        rows={1}
        placeholder="Např. velmi husté řasy, alergie na lepidlo…"
        className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-violet-500/60"
      />
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        Platí pro všechny rezervace této klientky. Vidí ji i mistr u své rezervace, klientka ne.
      </p>
    </div>
  )
}
