// Модал «Hledat klienta» — глобальный поиск клиента по имени / телефону / e-mailu
// (коллекция clients) без привязки к конкретной брони в гриде. Деталь клиента:
// контакты, статус блэклиста (+ toggle) и ВСЯ история резерваций (клик по брони →
// календарь переходит на её день и мигает карточкой — как из drawer'а).
// Кейс: клиентка пишет «резервировала неделю назад, потвrzení не пришло» — админ
// находит её по имени и сразу видит, есть ли брони и на какой e-mail они ушли.

import { useEffect, useRef, useState } from 'react'
import type { ClientHistoryItem } from '../fetch/calendarDay'
import { fetchClientHistory, todayStrPrague } from '../fetch/calendarDay'
import { searchClients, updateClientBlacklist, type ClientHit } from '../fetch/engineApi'
import { HistoryRow } from '../BookingDrawer'
import { ModalShell } from './ui'
import { inputCls } from './helpers'

// Сводка истории: короткие чипы по статусам (сколько всего/проběhlo/зрушено/nepřišla)
const SummaryChips = ({ rows }: { rows: ClientHistoryItem[] }) => {
  const count = (s: ClientHistoryItem['status']) => rows.filter((r) => r.status === s).length
  const chip = 'rounded-full px-2 py-0.5 text-[11px] font-semibold'
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`${chip} bg-gray-100 text-gray-600 dark:bg-[#2e2e2c] dark:text-gray-300`}>
        celkem {rows.length}
      </span>
      {count('checkedOut') > 0 && (
        <span className={`${chip} bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300`}>
          proběhlo {count('checkedOut')}
        </span>
      )}
      {count('cancelled') > 0 && (
        <span className={`${chip} bg-gray-200 text-gray-500 dark:bg-[#3a3a38] dark:text-gray-400`}>
          zrušeno {count('cancelled')}
        </span>
      )}
      {count('noshow') > 0 && (
        <span className={`${chip} bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300`}>
          nepřišla {count('noshow')}
        </span>
      )}
    </div>
  )
}

export const ClientSearchModal = ({
  onClose,
  onOpenBooking,
}: {
  onClose: () => void
  // клик по брони в истории → родитель закрывает модал и открывает её день в календаре
  onOpenBooking: (r: ClientHistoryItem) => void
}) => {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ClientHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<ClientHit | null>(null)
  const [history, setHistory] = useState<ClientHistoryItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  // последовательность запросов — ответ устаревшего поиска не перетирает свежий
  const seq = useRef(0)

  // Поиск с дебаунсом 300 мс (паттерн автокомплита NewBookingModal)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    const id = ++seq.current
    const t = setTimeout(() => {
      searchClients(q, 20)
        .then((res) => {
          if (seq.current === id) setHits(res)
        })
        .catch(() => {
          if (seq.current === id) setHits([])
        })
        .finally(() => {
          if (seq.current === id) setSearching(false)
        })
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // История выбранного клиента: по relation (documentId); пусто → фолбэк по имени
  // (старые импортные брони могут не иметь связи client)
  const selDocId = selected?.documentId
  const selName = selected?.name
  useEffect(() => {
    if (!selDocId) {
      setHistory(null)
      return
    }
    let cancelled = false
    setHistory(null)
    fetchClientHistory({ clientDocId: selDocId })
      .then((rows) => (rows.length ? rows : fetchClientHistory({ clientName: selName })))
      .then((rows) => {
        if (!cancelled) setHistory(rows)
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
    return () => {
      cancelled = true
    }
  }, [selDocId, selName])

  const toggleBlacklist = async () => {
    if (!selected) return
    const next = !selected.blacklisted
    const ok = window.confirm(
      next
        ? `Přidat klienta ${selected.name} na blacklist? Nebude se moci rezervovat přes web.`
        : `Odebrat klienta ${selected.name} z blacklistu?`,
    )
    if (!ok) return
    setBusy(true)
    try {
      await updateClientBlacklist(selected.documentId, next)
      setSelected({ ...selected, blacklisted: next })
      // список результатов за спиной тоже обновляем (вернётся «Zpět na výsledky»)
      setHits((prev) =>
        prev.map((h) => (h.documentId === selected.documentId ? { ...h, blacklisted: next } : h)),
      )
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const today = todayStrPrague()
  const rows = history || []
  const future = rows
    .filter((r) => r.date >= today)
    .sort((a, z) => (a.startsAt || '').localeCompare(z.startsAt || ''))
  const past = rows.filter((r) => r.date < today) // сортированы desc запросом

  return (
    <ModalShell title="Hledat klienta" onClose={onClose}>
      {!selected && (
        <>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jméno, telefon nebo e-mail…"
            className={inputCls}
          />
          <div className="mt-3 space-y-1.5">
            {searching && <p className="text-[12px] text-gray-400 dark:text-gray-500">Hledám…</p>}
            {!searching && query.trim().length >= 2 && hits.length === 0 && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500">
                Nikdo nenalezen. Zkuste část jména, telefonu nebo e-mailu.
              </p>
            )}
            {!searching && query.trim().length < 2 && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500">
                Zadejte aspoň 2 znaky — hledá se ve jménech, telefonech i e-mailech klientů.
              </p>
            )}
            {hits.map((h) => (
              <button
                key={h.documentId}
                type="button"
                onClick={() => setSelected(h)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-gray-400 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:hover:border-[#5a5a56]"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-300">
                      {h.name}
                    </span>
                    {h.blacklisted && (
                      <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                        ⛔ blacklist
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-gray-500 dark:text-gray-400">
                    {[h.phone, h.email].filter(Boolean).join(' · ') || 'bez kontaktu'}
                  </span>
                </span>
                <span className="shrink-0 text-gray-300 dark:text-gray-600">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {selected && (
        <>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-3 text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Zpět na výsledky
          </button>

          {/* Карточка «Kontakt» — стиль 1:1 с drawer'ом брони */}
          <div className="rounded-xl border border-gray-200 p-3 dark:border-[#2e2e2c]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Kontakt
              </span>
              <span className="truncate text-sm font-bold text-gray-900 dark:text-gray-300">
                {selected.name}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-[#252523]">
              {selected.phone ? (
                <a
                  href={`tel:${selected.phone}`}
                  className="font-semibold text-gray-800 hover:text-primary dark:text-gray-300"
                >
                  📞 {selected.phone}
                </a>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">📞 telefon není uveden</span>
              )}
              {selected.email ? (
                <a
                  href={`mailto:${selected.email}`}
                  className="break-all text-gray-800 hover:text-primary dark:text-gray-300"
                >
                  ✉️ {selected.email}
                </a>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">✉️ e-mail není uveden</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              {selected.blacklisted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                  ⛔ Na blacklistu
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Klient není na blacklistu
                </span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={toggleBlacklist}
                className={`rounded-md border px-3 py-2 text-xs font-semibold shadow-sm transition disabled:opacity-40 dark:shadow-none sm:px-2.5 sm:py-1 ${
                  selected.blacklisted
                    ? 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-[#3f3f3d] dark:bg-transparent dark:text-gray-300 dark:hover:bg-[#2e2e2c]'
                    : 'border-red-300 bg-white text-red-600 hover:bg-red-50 dark:border-red-500/50 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10'
                }`}
              >
                {selected.blacklisted ? 'Odebrat z blacklistu' : '⛔ Na blacklist'}
              </button>
            </div>
          </div>

          {/* История резерваций — та же разбивка будущие/прошлые, что в drawer'е */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-300">
                Historie rezervací
              </span>
              {history !== null && rows.length > 0 && <SummaryChips rows={rows} />}
            </div>
            {history === null && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500">Načítám…</p>
            )}
            {history !== null && rows.length === 0 && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500">Žádné rezervace.</p>
            )}
            {future.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Budoucí rezervace ({future.length})
                </div>
                <div className="space-y-1.5">
                  {future.map((r) => (
                    <HistoryRow key={r.documentId} r={r} onOpen={onOpenBooking} />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div
                className={`rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-[#2e2e2c] dark:bg-[#252523] ${future.length > 0 ? 'mt-2.5' : ''}`}
              >
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Proběhlé rezervace ({past.length})
                </div>
                <div className="space-y-1.5">
                  {past.map((r) => (
                    <HistoryRow key={r.documentId} r={r} onOpen={onOpenBooking} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </ModalShell>
  )
}
