// Drawer с деталями брони: кнопки статусов (пишут в движок), кастомный лейбл,
// инлайн-подтверждение отмены с уведомлением, услуги (+ «Změnit službu»),
// секция «Historie klienta» (все брони клиента, клик → переход на её день).

import { useEffect, useRef, useState } from 'react'
import type { CalendarBooking, ClientHistoryItem } from './fetch/calendarDay'
import { fetchClientHistory, todayStrPrague } from './fetch/calendarDay'
import type { BookingLabel } from './fetch/bookingLabels'
import type { BookingRedemption } from './fetch/engineApi'
import { fetchBookingRedemptions } from './fetch/engineApi'
import { STATUS_META, fmtTime } from './utils'

// Карточка «Štítek» (кастомные лейблы + «Spravovat štítky») временно скрыта по решению владельца.
// Вернуть = поставить true. Авто-лейблы по статусу на карточках грида это не трогает.
const SHOW_LABEL_CARD = false

// Строка истории клиента (прошлая/будущая бронь) — клик открывает её день в календаре.
// Экспортируется: переиспользуется в модале глобального поиска клиента (ClientSearchModal)
export const HistoryRow = ({ r, onOpen }: { r: ClientHistoryItem; onOpen: (r: ClientHistoryItem) => void }) => {
  const meta = STATUS_META[r.status] ?? STATUS_META.active
  const svc = (r.services || [])
    .map((s) => s.title)
    .filter(Boolean)
    .join(' + ')
  const d = `${r.date.split('-').reverse().slice(0, 2).join('. ')}.`
  return (
    <button
      type="button"
      onClick={() => onOpen(r)}
      className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left transition hover:border-gray-400 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:hover:border-[#5a5a56]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-300">{d}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-gray-900 dark:text-gray-300">{svc || 'bez služby'}</span>
        {r.employeeNameRaw && (
          <span className="shrink-0 text-[13px] font-semibold text-gray-900 dark:text-gray-300">{r.employeeNameRaw.split(' ')[0]}</span>
        )}
      </div>
    </button>
  )
}

// Секция «Historie klienta» в drawer — грузит брони клиента, делит на будущие/прошлые.
// restrictEmployeeId (роль master) → только брони ЭТОГО мастера с клиентом; визиты
// клиента к другим мастерам мастеру не показываются (и не запрашиваются).
const ClientHistory = ({
  b,
  onOpen,
  restrictEmployeeId,
}: {
  b: CalendarBooking
  onOpen: (r: ClientHistoryItem) => void
  restrictEmployeeId?: string | null
}) => {
  const [history, setHistory] = useState<ClientHistoryItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setHistory(null)
    setLoading(true)
    fetchClientHistory({
      clientDocId: b.client?.documentId,
      clientName: b.clientNameRaw,
      employeeNoonaId: restrictEmployeeId,
    })
      .then((rows) => {
        if (!cancelled) setHistory(rows.filter((r) => r.documentId !== b.documentId))
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [b.documentId, b.client?.documentId, b.clientNameRaw, restrictEmployeeId])

  const today = todayStrPrague()
  const rows = history || []
  const future = rows
    .filter((r) => r.date >= today)
    .sort((a, z) => (a.startsAt || '').localeCompare(z.startsAt || ''))
  const past = rows.filter((r) => r.date < today) // уже отсортированы desc

  return (
    <div className="mt-5 border-t border-gray-200 pt-3 dark:border-[#2e2e2c]">
      <div className="mb-2.5 text-sm font-bold text-gray-900 dark:text-gray-300">Historie klienta</div>
      {loading && <p className="text-[12px] text-gray-400 dark:text-gray-500">Načítám…</p>}
      {!loading && rows.length === 0 && <p className="text-[12px] text-gray-400 dark:text-gray-500">Žádné další rezervace.</p>}
      {future.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Budoucí rezervace ({future.length})
          </div>
          <div className="space-y-1.5">
            {future.map((r) => (
              <HistoryRow key={r.documentId} r={r} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div className={`rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-[#2e2e2c] dark:bg-[#252523] ${future.length > 0 ? 'mt-2.5' : ''}`}>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Proběhlé rezervace ({past.length})
          </div>
          <div className="space-y-1.5">
            {past.map((r) => (
              <HistoryRow key={r.documentId} r={r} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Лейбл награды bitchcard: «Sleva 20 %» / «Sleva 400 Kč» уже в title — добавляем порог
const redemptionRewardLabel = (r: BookingRedemption) =>
  `${r.reward.title} (od ${r.reward.thresholdKc.toLocaleString('cs-CZ')} Kč)`

// Карточка «Bitchcard» в drawer (walk-in флоу К4): награды available у клиента
// брони + применённая к этой брони. Свой fetch (паттерн ClientHistory); рефетч
// по totalPrice — после apply/release CalendarPage обновляет selected и данные
// перезагружаются. Программа выключена (enabled:false) / нет наград → карточки нет.
const LoyaltyCard = ({
  b,
  busy,
  onApply,
  onRelease,
}: {
  b: CalendarBooking
  busy: boolean
  onApply: (code: string) => void
  onRelease: () => void
}) => {
  const [redemptions, setRedemptions] = useState<BookingRedemption[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchBookingRedemptions(b.documentId)
      .then((res) => {
        if (!cancelled) setRedemptions(res.enabled ? res.redemptions : [])
      })
      .catch(() => {
        if (!cancelled) setRedemptions([])
      })
    return () => {
      cancelled = true
    }
  }, [b.documentId, b.totalPrice])

  const used = (redemptions || []).find(
    (r) => r.status === 'used' && r.usedInBookingDocId === b.documentId,
  )
  const available = (redemptions || []).filter((r) => r.status === 'available')
  if (!used && available.length === 0) return null

  // Рендерится ВНУТРИ главной карты брони (под ценой) — без своей рамки-карточки
  return (
    <div className="mt-2.5">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Bitchcard — věrnostní program
      </div>
      {used && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-500/10">
          <span className="text-emerald-800 dark:text-emerald-200">
            ✓ Uplatněno: <b>{redemptionRewardLabel(used)}</b>
            {used.discountKc != null && ` · −${used.discountKc} Kč`}
            {used.code && <span className="ml-1 font-mono text-xs">({used.code})</span>}
          </span>
          {b.status === 'active' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Zrušit uplatněnou slevu? Cena rezervace se vrátí zpět.')) onRelease()
              }}
              className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
            >
              Zrušit slevu
            </button>
          )}
        </div>
      )}
      {!used &&
        available.map((r) => (
          <div
            key={r.documentId}
            className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm last:mb-0 dark:bg-[#252523]"
          >
            <span className="min-w-0 text-gray-800 dark:text-gray-300">
              🎟 <b>{redemptionRewardLabel(r)}</b>
              {r.code && <span className="ml-1 font-mono text-xs text-gray-500 dark:text-gray-400">{r.code}</span>}
            </span>
            <button
              type="button"
              disabled={busy || !r.code}
              onClick={() => {
                if (
                  window.confirm(
                    `Uplatnit slevu „${r.reward.title}“ na tuto rezervaci? Cena se přepočítá.`,
                  )
                )
                  onApply(r.code || '')
              }}
              className="shrink-0 rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 disabled:opacity-40 dark:border-[#e71e6e80] dark:bg-transparent dark:shadow-none dark:hover:bg-[#e71e6e26] sm:px-2.5 sm:py-1"
            >
              Uplatnit slevu
            </button>
          </div>
        ))}
    </div>
  )
}

// Карточка «Sleva za dozápis» (rebook −15% с thank-you): показывает применённую
// скидку с кнопкой «Zrušit slevu» либо снятую с кнопкой «Vrátit slevu» —
// та же механика управления, что у bitchcard-redemption (LoyaltyCard выше).
const RebookDiscountCard = ({
  b,
  busy,
  onRemove,
  onRestore,
}: {
  b: CalendarBooking
  busy: boolean
  onRemove: () => void
  onRestore: () => void
}) => {
  const d = b.discount
  if (!d || d.type !== 'rebook') return null
  const editable = b.status === 'active'
  // Рендерится ВНУТРИ главной карты брони (под ценой) — без своей рамки-карточки
  return (
    <div className="mt-2.5">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Sleva za dozápis
      </div>
      {d.applied ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-500/10">
          <span className="text-emerald-800 dark:text-emerald-200">
            ✓ Uplatněno: <b>{`−${d.percent} %`}</b>
            {` · −${d.discountKc} Kč (běžná cena ${d.originalPrice} Kč)`}
          </span>
          {editable && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Zrušit slevu za dozápis? Cena rezervace se vrátí na plnou.')) onRemove()
              }}
              className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
            >
              Zrušit slevu
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm dark:bg-[#252523]">
          <span className="text-gray-600 dark:text-gray-400">
            {`Sleva −${d.percent} % (−${d.discountKc} Kč) je zrušená — klient platí plnou cenu.`}
          </span>
          {editable && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Vrátit slevu za dozápis? Cena rezervace se sníží o slevu.')) onRestore()
              }}
              className="shrink-0 rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 disabled:opacity-40 dark:border-[#e71e6e80] dark:bg-transparent dark:shadow-none dark:hover:bg-[#e71e6e26] sm:px-2.5 sm:py-1"
            >
              Vrátit slevu
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Человеческие названия каналов Noona (bsChannel зеркальных броней)
const CHANNEL_LABELS: Record<string, string> = {
  bookingLink: 'web (rezervační odkaz)',
  calendar: 'Noona kalendář (ručně)',
  app: 'aplikace Noona',
  web: 'web noona.app',
  reserveWithGoogle: 'Google',
}

// «Кем/через что» создана бронь: движковые по origin (site/admin+имя админа),
// зеркальные Noona — по bsChannel (fallback сырой origin)
const bookingSourceLabel = (b: CalendarBooking): string | null => {
  if (b.origin === 'admin') return b.createdByName ? `kalendář — ${b.createdByName}` : 'kalendář (admin)'
  if (b.origin === 'site') return 'web barbitch.cz'
  const ch = b.bsChannel || b.origin
  return ch ? (CHANNEL_LABELS[ch] ?? ch) : null
}

// Момент создания брони: зеркальные несут noonaCreatedAt, движковые — createdAt
const bookingCreatedLabel = (b: CalendarBooking): string | null => {
  const iso = b.noonaCreatedAt || b.createdAt
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// «Ne 19. 7. 2026» — дата брони с днём недели (сразу видно, о каком дне речь)
const CS_DOW = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
const dateLabelCs = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return `${CS_DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}. ${m}. ${y}`
}

// Drawer с деталями брони + кнопки статусов (пишут в движок).
// readOnly (роль master): чисто информационный вид — без кнопок статусов/переноса/
// смены услуги/лейблов/удаления; детали и история клиента остаются.
export const BookingDrawer = ({
  b,
  labels,
  onClose,
  onStatus,
  onSaveComment,
  onToggleBlacklist,
  onArrived,
  onLabel,
  onManageLabels,
  onOpenHistory,
  onChangeService,
  onReschedule,
  onDelete,
  onApplyRedemption,
  onReleaseRedemption,
  onRemoveRebookDiscount,
  onRestoreRebookDiscount,
  busy,
  readOnly = false,
  masterRate = null,
  historyEmployeeId = null,
}: {
  b: CalendarBooking
  labels: BookingLabel[]
  onClose: () => void
  // note — необязательная позна́мка при отмене/noshow, дописывается к comment брони
  onStatus: (status: CalendarBooking['status'], notify?: boolean, note?: string) => void
  // сохранение интерн-позна́мки (карточка «Poznámka» — свободная заметка админа)
  onSaveComment: (comment: string) => void
  // блэклист клиента (карточка Kontakt) — блокирует ему запись через сайт
  onToggleBlacklist: (next: boolean) => void
  onArrived: () => void
  onLabel: (label: { name: string; color: string } | null) => void
  onManageLabels: () => void
  onOpenHistory: (r: ClientHistoryItem) => void
  onChangeService: () => void
  onReschedule: () => void
  onDelete: () => void
  // bitchcard (walk-in): применить/снять награду клиента на эту бронь
  onApplyRedemption: (code: string) => void
  onReleaseRedemption: () => void
  // скидка дозаписи (rebook −15% с thank-you): снять / вернуть
  onRemoveRebookDiscount: () => void
  onRestoreRebookDiscount: () => void
  busy: boolean
  readOnly?: boolean
  // процент мастера — если задан, «Celkem» показывает его долю, а не полную цену
  masterRate?: number | null
  // id мастера (noonaEmployeeId) — история клиента ограничивается его бронями.
  // Задаётся только для роли master; у админа/владельца null = вся история.
  historyEmployeeId?: string | null
}) => {
  // active + arrived → зелёный бейдж «dorazila» (промежуточный шаг перед proběhla)
  const meta =
    b.status === 'active' && b.arrived
      ? { label: 'dorazila', cls: 'bg-green-100 text-green-700' }
      : (STATUS_META[b.status] ?? STATUS_META.active)
  const hasEmail = Boolean((b.client?.email ?? '').trim())
  // инлайн-подтверждение отмены с чекбоксом «уведомить клиента» (роадмап §4.2)
  const [cancelling, setCancelling] = useState(false)
  const [notifyCancel, setNotifyCancel] = useState(hasEmail)
  const [cancelNote, setCancelNote] = useState('')
  // инлайн-подтверждение «Nepřišla» (с необязательной позна́мкой, как у отмены)
  const [noshowing, setNoshowing] = useState(false)
  const [noshowNote, setNoshowNote] = useState('')
  // инлайн-подтверждение ПОЛНОГО удаления брони (корзина — жёсткий delete, не отмена)
  const [deleting, setDeleting] = useState(false)
  // черновик интерн-позна́мки (карточка «Poznámka»); ре-синк при смене брони —
  // drawer не размонтируется между брониями (нет key), state сам не сбросится
  const [commentDraft, setCommentDraft] = useState(b.comment || '')
  useEffect(() => {
    setCommentDraft(b.comment || '')
    setCancelling(false)
    setNoshowing(false)
    setDeleting(false)
    setCancelNote('')
    setNoshowNote('')
  }, [b.documentId]) // eslint-disable-line react-hooks/exhaustive-deps
  const commentChanged = commentDraft.trim() !== (b.comment || '').trim()
  // авто-высота позна́мки: с контентом растёт под текст (кап 240px), пустая — компактная
  const commentRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const el = commentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, 240)}px`
  }, [commentDraft, b.documentId])
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 dark:bg-black/60" />
      <div
        className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-xl dark:bg-[#1f1f1e] dark:text-gray-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Скроллящийся контент; кнопки статусов — фиксированный футер ниже */}
        <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-md font-bold text-gray-900 dark:text-gray-300">{b.clientNameRaw || '—'}</div>
            <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
              {meta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="-m-2 p-2 text-sm1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        

        {/* ГЛАВНАЯ КАРТА БРОНИ (розовый акцент): термин + мастер + услуги + цена +
            скидки + действия — вся суть брони одним взглядом сразу при открытии.
            Остальные секции (kontakt/poznámka/vytvořeno/historie) — нейтральные ниже. */}
        <div className="mt-4 rounded-xl border border-pink-200 bg-pink-50/60 p-3 dark:border-[#e71e6e40] dark:bg-[#e71e6e0f]">
          <div className="text-[15px] font-bold text-gray-900 dark:text-gray-200">
            {dateLabelCs(b.date)} · {fmtTime(b.startsAt)}–{fmtTime(b.endsAt)}
          </div>
          {b.employeeNameRaw && (
            <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{b.employeeNameRaw}</div>
          )}
          <div className="my-2.5 border-t border-pink-200/80 dark:border-[#e71e6e26]" />
          <div className="space-y-1.5">
            {(b.services || []).map((s, i) => (
              <div key={i} className="flex justify-between gap-2 rounded-lg bg-white/80 px-3 py-1.5 dark:bg-[#252523] text-sm">
                <span className="text-gray-800 dark:text-gray-300">{s.title}</span>
                <span className="text-gray-500 dark:text-gray-400 text-nowrap">
                   {s.durationMin ? `${s.durationMin} min` : ''}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            {/* Мастеру (masterRate) показываем его долю, а не полную цену услуги */}
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Celkem</span>
            <span className="text-sm1 font-bold text-primary">
              {b.totalPrice == null
                ? '—'
                : masterRate != null
                  ? `${Math.round((b.totalPrice * masterRate) / 100)} Kč`
                  : `${b.totalPrice} Kč`}
            </span>
          </div>

          {/* Скидки — сразу под ценой, к которой относятся. Bitchcard: только админам
              и только active/checkedOut (сервер это тоже проверяет); rebook −15% тоже. */}
          {!readOnly && b.client?.documentId && (b.status === 'active' || b.status === 'checkedOut') && (
            <LoyaltyCard b={b} busy={busy} onApply={onApplyRedemption} onRelease={onReleaseRedemption} />
          )}
          {!readOnly && (
            <RebookDiscountCard
              b={b}
              busy={busy}
              onRemove={onRemoveRebookDiscount}
              onRestore={onRestoreRebookDiscount}
            />
          )}

          {/* Действия над активной бронью — внутри главной карты, не надо искать */}
          {b.status === 'active' && !readOnly && (
            <div className="mt-2.5 flex gap-2 border-t border-pink-200/80 pt-2.5 dark:border-[#e71e6e26]">
              <button
                type="button"
                onClick={onReschedule}
                className="flex-1 rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 dark:border-[#e71e6e80] dark:bg-transparent dark:shadow-none dark:hover:bg-[#e71e6e26]"
              >
                Změnit termín
              </button>
              <button
                type="button"
                onClick={onChangeService}
                className="flex-1 rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 dark:border-[#e71e6e80] dark:bg-transparent dark:shadow-none dark:hover:bg-[#e71e6e26]"
              >
                Změnit službu
              </button>
            </div>
          )}
        </div>

        {/* Kontakt (компакт): телефон/e-mail, блэклист-кнопка в шапке карточки.
            Блэклист блокирует клиенту ТОЛЬКО запись через сайт (движок 403);
            из календаря админ бронировать может как раньше. Кнопка — только у броней
            со связанным клиентом (у старых импортных связи нет).
            Мастерам (readOnly) карточку НЕ показываем — контакты только для админов. */}
        {!readOnly && (
        <div className="mt-3 rounded-xl border border-gray-200 p-3 dark:border-[#2e2e2c]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Kontakt
            </span>
            {b.client?.documentId && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const next = !b.client?.blacklisted
                  const ok = window.confirm(
                    next
                      ? `Přidat klienta ${b.clientNameRaw} na blacklist? Nebude se moci rezervovat přes web.`
                      : `Odebrat klienta ${b.clientNameRaw} z blacklistu?`,
                  )
                  if (ok) onToggleBlacklist(next)
                }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-40 ${
                  b.client.blacklisted
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30'
                    : 'border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/50 dark:text-red-300 dark:hover:bg-red-500/10'
                }`}
              >
                {b.client.blacklisted ? '⛔ Na blacklistu · zrušit' : '⛔ Na blacklist'}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#252523] text-sm">
            {b.client?.phone ? (
              <a
                href={`tel:${b.client.phone}`}
                className="font-semibold text-gray-800 hover:text-primary dark:text-gray-300"
              >
                {b.client.phone}
              </a>
            ) : (
              <span className="text-gray-400 dark:text-gray-500">telefon není uveden</span>
            )}
            {b.client?.email ? (
              <a
                href={`mailto:${b.client.email}`}
                className="break-all text-gray-800 hover:text-primary dark:text-gray-300"
              >
                {b.client.email}
              </a>
            ) : (
              <span className="text-gray-400 dark:text-gray-500">e-mail není uveden</span>
            )}
          </div>
        </div>
        )}

        {/* Интерн-позна́мка: админам — редактируемая карточка (свободная заметка,
            дописываются и заметки отмены/noshow); мастерам (readOnly) — статично */}
        {!readOnly && (
          <div className="mt-3 rounded-xl border border-gray-200 p-3 dark:border-[#2e2e2c]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Poznámka
              </span>
              {commentChanged && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSaveComment(commentDraft.trim())}
                  className="rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 dark:border-[#e71e6e80] dark:bg-transparent dark:shadow-none dark:hover:bg-[#e71e6e26] disabled:opacity-40 sm:px-2.5 sm:py-1"
                >
                  Uložit poznámku
                </button>
              )}
            </div>
            <textarea
              ref={commentRef}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={1}
              placeholder="Interní poznámka k rezervaci… (klient ji nevidí)"
              className="w-full resize-none rounded-lg border border-gray-200 bg-amber-50/60 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-pink-300 focus:outline-none dark:border-[#3f3f3d] dark:bg-[#2a2a24] dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-[#e71e6e99]"
            />
          </div>
        )}
        {(readOnly && b.comment) || b.customerComment ? (
          <div className="mt-3 space-y-2">
            {readOnly && b.comment && (
              <div className="whitespace-pre-line rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                <b>Poznámka:</b> {b.comment}
              </div>
            )}
            {b.customerComment && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
                <b>Klient:</b> {b.customerComment}
              </div>
            )}
          </div>
        ) : null}

        {/* Read-only (master): štítek показываем статично, без управления */}
        {SHOW_LABEL_CARD && readOnly && b.label && (
          <div className="mt-3 rounded-xl border border-gray-200 p-3 dark:border-[#2e2e2c]">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Štítek</div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.label.color }} />
              {b.label.name}
            </span>
          </div>
        )}

        {/* Карточка «Štítek» (только активные; прошедшие/отменённые получают авто-лейбл) */}
        {SHOW_LABEL_CARD && b.status === 'active' && !readOnly && (
          <div className="mt-3 rounded-xl border border-gray-200 p-3 dark:border-[#2e2e2c]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Štítek</span>
              <button type="button" onClick={onManageLabels} className="rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 dark:border-[#e71e6e80] dark:bg-transparent dark:shadow-none dark:hover:bg-[#e71e6e26] sm:px-2.5 sm:py-1">
                Spravovat štítky
              </button>
            </div>
            {labels.length ? (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const isSet = b.label?.name === l.name && b.label?.color === l.color
                  return (
                    <button
                      key={l.documentId}
                      type="button"
                      disabled={busy}
                      onClick={() => onLabel(isSet ? null : { name: l.name, color: l.color })}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition disabled:opacity-40 sm:px-2.5 sm:py-1 ${
                        isSet ? 'border-gray-700 bg-gray-100 text-gray-900' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                      {l.name}
                      {isSet && <span className="text-gray-400">✕</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Zatím žádné štítky — vytvořte je přes „Spravovat štítky“.</p>
            )}
          </div>
        )}

        {/* Когда/кем/через что создана резервация (движок: site/admin+имя; зеркало: канал Noona) */}
        {(bookingCreatedLabel(b) || bookingSourceLabel(b)) && (
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#252523] text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-600 dark:text-gray-300">Vytvořeno:</span>{' '}
            {[bookingCreatedLabel(b), bookingSourceLabel(b)].filter(Boolean).join(' · ')}
          </div>
        )}

        <ClientHistory b={b} onOpen={onOpenHistory} restrictEmployeeId={historyEmployeeId} />
        </div>

        {/* Фиксированный футер: кнопки статусов (+ инлайн-подтверждение отмены).
            pb с safe-area — кнопки не прячутся за жестовую полосу iPhone.
            readOnly (master) — футера нет вообще, drawer чисто информационный */}
        {!readOnly && (
        <div className="border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-[#2e2e2c] dark:bg-[#1f1f1e]">
          {deleting && (
            <div className="mb-3 space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-500/40 dark:bg-red-500/10">
              <div className="text-sm font-semibold text-red-800 dark:text-red-200">
                Smazat rezervaci {b.clientNameRaw} úplně?
              </div>
              <p className="text-xs text-red-700 dark:text-red-300">
                Rezervace zmizí z kalendáře i historie klienta. Toto nelze vrátit zpět — pro běžné
                zrušení použijte „Zrušit“.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDelete}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Smazat navždy
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeleting(false)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
                >
                  Zpět
                </button>
              </div>
            </div>
          )}
          {cancelling && b.status === 'active' && (
            <div className="mb-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/40 dark:bg-red-500/10">
              <div className="text-sm font-semibold text-red-800 dark:text-red-200">
                Zrušit rezervaci {b.clientNameRaw}?
              </div>
              <label
                className={`flex items-center gap-2 text-sm ${hasEmail ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}
              >
                <input
                  type="checkbox"
                  disabled={!hasEmail}
                  checked={notifyCancel && hasEmail}
                  onChange={(e) => setNotifyCancel(e.target.checked)}
                />
                Poslat klientovi e-mail o zrušení
                {!hasEmail && <span className="text-xs">(klient nemá e-mail)</span>}
              </label>
              <textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                rows={2}
                placeholder="Poznámka ke zrušení (nepovinné) — uloží se k rezervaci"
                className="w-full resize-y rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-red-400 focus:outline-none dark:border-red-500/40 dark:bg-[#2a2a28] dark:text-gray-300 dark:placeholder:text-gray-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStatus('cancelled', notifyCancel && hasEmail, cancelNote)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Potvrdit zrušení
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCancelling(false)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
                >
                  Zpět
                </button>
              </div>
            </div>
          )}
          {noshowing && b.status === 'active' && (
            <div className="mb-3 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Označit rezervaci {b.clientNameRaw} jako „Nepřišla“?
              </div>
              <textarea
                value={noshowNote}
                onChange={(e) => setNoshowNote(e.target.value)}
                rows={2}
                placeholder="Poznámka (nepovinné) — uloží se k rezervaci"
                className="w-full resize-y rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none dark:border-amber-500/40 dark:bg-[#2a2a28] dark:text-gray-300 dark:placeholder:text-gray-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStatus('noshow', undefined, noshowNote)}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
                >
                  Potvrdit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setNoshowing(false)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
                >
                  Zpět
                </button>
              </div>
            </div>
          )}
          {/* Верхняя кнопка — только пока бронь активна: без прихода → «Dorazila»
              (зелёная), после прихода (arrived) → «Proběhla» (checkedOut).
              Уже проведённая/отменённая/noshow — кнопки нет (её смысл потерян;
              вернуть в active можно кнопкой «Obnovit» ниже). */}
          {b.status === 'active' && (
            <div className={'mb-2'}>
              {!b.arrived ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onArrived}
                  className="w-full text-nowrap rounded-md bg-green-600 px-3 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40 sm:py-2"
                >
                  ✓ Dorazila
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStatus('checkedOut')}
                  className="w-full text-nowrap rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 sm:py-2"
                >
                  ✓ Proběhla
                </button>
              )}
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            {b.status === 'active' ? (
              <>
              
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setNoshowing(true)
                    setCancelling(false)
                    setDeleting(false)
                  }}
                  className="flex-1 rounded-md bg-red-600 px-3 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 sm:py-2"
                >
                  Nepřišla
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCancelling(true)
                    setNoshowing(false)
                    setDeleting(false)
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 sm:py-2"
                >
                  Zrušit
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus('active')}
                className="flex-1 rounded-md border border-pink-300 px-3 py-3 text-sm font-semibold text-pink-700 hover:bg-pink-50 disabled:opacity-40 dark:border-[#e71e6e80] dark:text-pink-300 dark:hover:bg-[#e71e6e1a] sm:py-2"
              >
                ↩ Obnovit (aktivní)
              </button>
            )}
            {/* Корзина: полное удаление брони (с инлайн-подтверждением выше) */}
            <button
              type="button"
              disabled={busy}
              title="Smazat rezervaci úplně"
              onClick={() => {
                setDeleting(true)
                setCancelling(false)
                setNoshowing(false)
              }}
              className="shrink-0 rounded-md border border-red-300 bg-white px-3.5 py-3 text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-500/50 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10 sm:px-2.5 sm:py-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
