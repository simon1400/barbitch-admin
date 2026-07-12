// Модалы календаря-write: «+ Rezervace» (walk-in бронь админом — поиск клиента,
// пикер услуги/варианта/допов из salon-service, цена по tier мастера, override)
// и «+ Blok» (нерабочее время). Всё пишет в наш движок (/api/engine/admin/*).

import { useEffect, useMemo, useRef, useState } from 'react'
import type { BlockedRange, CalendarBooking, CalendarEmployee } from './fetch/calendarDay'
import { saveEmployeesOrder } from './fetch/calendarDay'
import type { CatalogService, ClientHit, EnginePatchResult } from './fetch/engineApi'
import {
  JUNIOR_DISCOUNT_PERCENT,
  calcCombo,
  engineCreateBlock,
  engineCreateBooking,
  engineDeleteBlock,
  enginePatchBlock,
  enginePatchBooking,
  fetchBlockSeriesCount,
  fetchCatalog,
  searchClients,
} from './fetch/engineApi'
import {
  LABEL_COLORS,
  createBookingLabel,
  deleteBookingLabel,
  fetchBookingLabels,
  updateBookingLabel,
  type BookingLabel,
} from './fetch/bookingLabels'

const fmtHM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Слоты времени брони: 10:00–19:00, шаг 30 мин
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let m = 10 * 60; m <= 19 * 60; m += 30) out.push(fmtHM(m))
  return out
})()

// Дни недели: value = getUTCDay (0=Ne..6=So), порядок Po..Ne
const WEEKDAYS: { v: number; label: string }[] = [
  { v: 1, label: 'Po' },
  { v: 2, label: 'Út' },
  { v: 3, label: 'St' },
  { v: 4, label: 'Čt' },
  { v: 5, label: 'Pá' },
  { v: 6, label: 'So' },
  { v: 0, label: 'Ne' },
]
const addDays = (d: string, n: number): string =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)
const weekdayOf = (d: string): number => new Date(`${d}T00:00:00Z`).getUTCDay()
const blokPlural = (n: number): string => (n === 1 ? 'blok' : n >= 2 && n <= 4 ? 'bloky' : 'bloků')

const inputCls = 'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm'
const labelCls = 'mb-1 block text-xs font-semibold text-gray-500'

const ModalShell = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/30" />
    <div
      className="relative mt-8 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-md font-bold text-gray-900">{title}</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm1">
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
)

// Обособленный блок формы: рамка + фон + заголовок-метка
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
    <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{title}</legend>
    <div className="space-y-2.5">{children}</div>
  </fieldset>
)

// Бейдж доплаты (название всегда отделено от цены)
const PriceBadge = ({ diff }: { diff: number }) =>
  diff > 0 ? (
    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
      +{diff} Kč
    </span>
  ) : (
    <span className="shrink-0 text-xs text-gray-400">v ceně</span>
  )

// Строка выбора: индикатор + название слева, цена справа (radio — вариант, checkbox — доплněk)
const OptionRow = ({
  active,
  radio,
  disabled,
  name,
  hint,
  priceDiff,
  onClick,
}: {
  active: boolean
  radio: boolean
  disabled?: boolean
  name: string
  hint?: string
  priceDiff: number
  onClick: () => void
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${
      active ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300'
    } disabled:cursor-not-allowed disabled:opacity-40`}
  >
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${radio ? 'rounded-full' : 'rounded'} ${
          active ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'
        }`}
      >
        {active && <span className="text-[9px] leading-none">✓</span>}
      </span>
      <span className="truncate text-sm text-gray-800">
        {name}
        {hint && <span className="ml-1.5 text-[10px] text-gray-400">{hint}</span>}
      </span>
    </span>
    <PriceBadge diff={priceDiff} />
  </button>
)

// ── Порядок колонок мастеров (personal.calendarOrder) ──

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
      <p className="mb-3 text-xs text-gray-400">
        Pořadí sloupců v kalendáři (zleva doprava). Platí pro všechny administrátory.
      </p>
      <div className="space-y-1.5">
        {list.map((e, i) => (
          <div
            key={e.docId}
            className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm text-gray-800">
              <span className="w-5 text-right text-xs text-gray-400">{i + 1}.</span>
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
                className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === list.length - 1 || saving}
                onClick={() => move(i, 1)}
                className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
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

// ── Выбор действия по клику на пустую ячейку: rezervace / blok ──

export const CellActionModal = ({
  masterName,
  date,
  time,
  onClose,
  onReservation,
  onBlock,
}: {
  masterName: string
  date: string
  time: string
  onClose: () => void
  onReservation: () => void
  onBlock: () => void
}) => {
  const ddmm = `${date.split('-').reverse().slice(0, 2).join('. ')}.`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-xs rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-md font-bold text-gray-900">Přidat</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {time} · {ddmm} · {masterName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm1">
            ✕
          </button>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onReservation}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            + Nová rezervace
          </button>
          <button
            type="button"
            onClick={onBlock}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            + Nový blok
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Пикер услуги (kategorie → služba → varianta → doplňky) — общий для
// «Nová rezervace» и «Změnit službu» ──

interface ServiceSelection {
  service: CatalogService | null
  variantLabel: string
  modKeys: string[]
}
const EMPTY_SERVICE_SELECTION: ServiceSelection = { service: null, variantLabel: '', modKeys: [] }

const ServicePicker = ({
  catalog,
  sel,
  onChange,
}: {
  catalog: CatalogService[]
  sel: ServiceSelection
  onChange: (v: ServiceSelection) => void
}) => {
  const categories = useMemo(() => [...new Set(catalog.map((s) => s.category))], [catalog])
  const [category, setCategory] = useState('')
  useEffect(() => {
    if (!category && categories.length) setCategory(sel.service?.category || categories[0])
  }, [categories, category, sel.service])
  const services = useMemo(() => catalog.filter((s) => s.category === category), [catalog, category])
  useEffect(() => {
    // смена категории → первая её услуга; сброс варианта/допов
    if (services.length && !services.some((s) => s.documentId === sel.service?.documentId)) {
      onChange({ service: services[0], variantLabel: '', modKeys: [] })
    }
  }, [services, sel.service, onChange])

  const svc = sel.service
  const toggleMod = (key: string) => {
    if (!svc) return
    const mod = svc.modifiers.find((m) => m.key === key)
    const cur = sel.modKeys
    let next: string[]
    if (cur.includes(key)) {
      next = cur.filter((k) => k !== key)
    } else {
      // взаимоисключающая группа: снимаем других из той же группы
      const sameGroup = mod?.group
        ? svc.modifiers.filter((m) => m.group === mod.group && m.key !== key).map((m) => m.key)
        : []
      next = [...cur.filter((k) => !sameGroup.includes(k)), key]
    }
    onChange({ ...sel, modKeys: next })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className={labelCls}>Kategorie</span>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelCls}>Služba</span>
          <select
            className={inputCls}
            value={svc?.documentId || ''}
            onChange={(e) =>
              onChange({
                service: services.find((s) => s.documentId === e.target.value) || null,
                variantLabel: '',
                modKeys: [],
              })
            }
          >
            {services.map((s) => (
              <option key={s.documentId} value={s.documentId}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {svc && svc.variants.length > 0 && (
        <div>
          <span className={labelCls}>Varianta</span>
          <div className="space-y-1">
            <OptionRow
              radio
              active={!sel.variantLabel}
              name="Základní varianta"
              priceDiff={0}
              onClick={() => onChange({ ...sel, variantLabel: '' })}
            />
            {svc.variants.map((v) => (
              <OptionRow
                key={v.label}
                radio
                active={sel.variantLabel === v.label}
                name={v.label}
                hint={v.durationDiff ? `+${v.durationDiff} min` : undefined}
                priceDiff={v.priceDiff}
                onClick={() => onChange({ ...sel, variantLabel: v.label })}
              />
            ))}
          </div>
        </div>
      )}

      {svc && svc.modifiers.length > 0 && (
        <div>
          <span className={labelCls}>Doplňky</span>
          <div className="space-y-1">
            {svc.modifiers.map((m) => (
              <OptionRow
                key={m.key}
                radio={false}
                active={sel.modKeys.includes(m.key)}
                name={m.label}
                hint={m.group ? `skupina: ${m.group}` : undefined}
                priceDiff={m.priceDiff}
                onClick={() => toggleMod(m.key)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── «+ Rezervace» ──

export interface NewBookingInitial {
  employeeDocId?: string
  date: string
  time?: string
}

interface NewBookingProps {
  employees: CalendarEmployee[]
  initial: NewBookingInitial
  onClose: () => void
  onCreated: () => void
}

export const NewBookingModal = ({ employees, initial, onClose, onCreated }: NewBookingProps) => {
  const [employeeDocId, setEmployeeDocId] = useState(initial.employeeDocId || employees[0]?.docId || '')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time || '10:00')

  // клиент: поиск / новый
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ClientHit[]>([])
  const [client, setClient] = useState<ClientHit | null>(null)
  const [newClient, setNewClient] = useState(false)
  const [ncName, setNcName] = useState('')
  const [ncPhone, setNcPhone] = useState('')
  const [ncEmail, setNcEmail] = useState('')
  const searchSeq = useRef(0)

  // услуга
  const [catalog, setCatalog] = useState<CatalogService[]>([])
  const [sel, setSel] = useState<ServiceSelection>(EMPTY_SERVICE_SELECTION)

  const [priceOverride, setPriceOverride] = useState('')
  const [comment, setComment] = useState('')
  const [notify, setNotify] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // e-mail клиента (выбранного или нового) — гейт чекбокса «poslat potvrzení»
  const clientEmail = newClient ? ncEmail.trim() : (client?.email ?? '').trim()
  const hasEmail = Boolean(clientEmail)
  // дефолт по роадмапу §4.3: вкл, когда у клиента есть e-mail
  useEffect(() => {
    setNotify(hasEmail)
  }, [hasEmail])

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch(() => setError('Nepodařilo se načíst katalog služeb'))
  }, [])

  // дебаунс-поиск клиентов
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    const seq = ++searchSeq.current
    const t = setTimeout(() => {
      searchClients(q)
        .then((res) => {
          if (searchSeq.current === seq) setHits(res)
        })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const svc = sel.service
  const employee = employees.find((e) => e.docId === employeeDocId)

  const pricing = svc ? calcCombo(svc, sel.variantLabel || null, sel.modKeys, employee?.tier || 'senior') : null
  const endTime = useMemo(() => {
    if (!pricing || !/^\d{2}:\d{2}$/.test(time)) return null
    const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
    return fmtHM(start + pricing.durationMin)
  }, [pricing, time])

  const canSubmit =
    Boolean(employeeDocId && date && /^\d{2}:\d{2}$/.test(time) && svc) &&
    (newClient ? Boolean(ncName.trim() && ncPhone.trim()) : Boolean(client))

  const submit = async () => {
    if (!canSubmit || !svc) return
    setSubmitting(true)
    setError(null)
    try {
      await engineCreateBooking({
        employee: employeeDocId,
        date,
        time,
        services: [{ service: svc.documentId, variant: sel.variantLabel || null, modifiers: sel.modKeys }],
        ...(newClient
          ? { client: { name: ncName.trim(), phone: ncPhone.trim(), email: ncEmail.trim() || undefined } }
          : { clientDocId: client!.documentId }),
        priceOverride: priceOverride.trim() ? Number(priceOverride) : undefined,
        comment: comment.trim() || undefined,
        notify: notify && hasEmail,
      })
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Nová rezervace" onClose={onClose}>
      <div className="space-y-3">
        {/* ── Клиент ── */}
        <Section title="Klient">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setNewClient(!newClient)
                setClient(null)
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {newClient ? '← hledat existující' : '+ nový klient'}
            </button>
          </div>
          {newClient ? (
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Jméno *" value={ncName} onChange={(e) => setNcName(e.target.value)} />
              <input className={inputCls} placeholder="Telefon *" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} />
              <input className={`${inputCls} col-span-2`} placeholder="E-mail" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} />
            </div>
          ) : client ? (
            <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
              <div>
                <b>{client.name}</b> <span className="text-gray-500">{client.phone}</span>
                {client.blacklisted && (
                  <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                    BLACKLIST
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setClient(null)} className="text-gray-400 hover:text-red-500">
                ✕
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                className={inputCls}
                placeholder="Hledat podle jména / telefonu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {hits.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {hits.map((h) => (
                    <button
                      key={h.documentId}
                      type="button"
                      onClick={() => {
                        setClient(h)
                        setHits([])
                        setQuery('')
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span>
                        {h.name}
                        {h.blacklisted && <span className="ml-1 text-[10px] font-bold text-red-600">⛔</span>}
                      </span>
                      <span className="text-xs text-gray-400">{h.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── Услуга ── */}
        <Section title="Služba">
          <ServicePicker catalog={catalog} sel={sel} onChange={setSel} />
        </Section>

        {/* ── Мастер + дата/время + итог ── */}
        <Section title="Termín">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className={labelCls}>Mistr</span>
              <select className={inputCls} value={employeeDocId} onChange={(e) => setEmployeeDocId(e.target.value)}>
                {employees.map((e) => (
                  <option key={e.docId} value={e.docId}>
                    {e.name}
                    {e.tier === 'junior' ? ' (junior)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={labelCls}>Datum</span>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <span className={labelCls}>Čas</span>
              <select className={inputCls} value={time} onChange={(e) => setTime(e.target.value)}>
                {(TIME_OPTIONS.includes(time) ? TIME_OPTIONS : [...TIME_OPTIONS, time].sort()).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {pricing && (
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{pricing.durationMin} min</span>
                  {endTime && <span>· do {endTime}</span>}
                </span>
                {employee?.tier === 'junior' && (
                  <span className="w-fit rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                    junior −20 %
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                {employee?.tier === 'junior' && (
                  <span className="text-xs font-normal text-gray-400 line-through">{pricing.seniorPrice} Kč</span>
                )}
                <span className="text-base font-bold leading-none text-primary">{pricing.price} Kč</span>
              </div>
            </div>
          )}
        </Section>

        {/* ── Оплата и заметка ── */}
        <Section title="Platba a poznámka">
          <div>
            <span className={labelCls}>Cena ručně (Kč)</span>
            <input
              className={inputCls}
              placeholder={pricing ? String(pricing.price) : ''}
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value.replace(/[^\d]/g, ''))}
            />
            <p className="mt-1 text-[10px] leading-tight text-gray-400">
              Vyplňte jen při individuální ceně. Prázdné = vypočtená ({pricing ? `${pricing.price} Kč` : '—'}).
            </p>
          </div>
          <div>
            <span className={labelCls}>Poznámka</span>
            <input className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>

          {/* Уведомление клиента (роадмап §4.3): письмо-подтверждение с ICS */}
          {hasEmail ? (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-gray-300">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              Poslat klientovi potvrzení e-mailem
            </label>
          ) : (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-400">
              Klient nemá e-mail — potvrzení nelze odeslat.
            </p>
          )}
        </Section>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Zrušit
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? 'Vytvářím…' : 'Vytvořit rezervaci'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ── «Změnit službu» — смена услуги существующей брони (PATCH serviceItems:
// сервер пишет новый снапшот services, пересчитывает цену/длительность и
// перепроверяет пересечения — при конфликте вернёт slot_taken) ──

export const ChangeServiceModal = ({
  booking,
  employees,
  onClose,
  onChanged,
}: {
  booking: CalendarBooking
  employees: CalendarEmployee[]
  onClose: () => void
  onChanged: (updated: EnginePatchResult) => void
}) => {
  const [catalog, setCatalog] = useState<CatalogService[]>([])
  const [sel, setSel] = useState<ServiceSelection>(EMPTY_SERVICE_SELECTION)
  const [priceOverride, setPriceOverride] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch(() => setError('Nepodařilo se načíst katalog služeb'))
  }, [])

  // tier мастера брони — junior-цена считается как в «Nová rezervace»
  const tier = employees.find((e) => e.id === booking.noonaEmployeeId)?.tier || 'senior'
  const svc = sel.service
  const pricing = svc ? calcCombo(svc, sel.variantLabel || null, sel.modKeys, tier) : null
  const currentTitle = (booking.services || [])
    .map((s) => s.title)
    .filter(Boolean)
    .join(' + ')

  const submit = async () => {
    if (!svc) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await enginePatchBooking(booking.documentId, {
        serviceItems: [{ service: svc.documentId, variant: sel.variantLabel || null, modifiers: sel.modKeys }],
        ...(priceOverride.trim() ? { totalPrice: Number(priceOverride) } : {}),
      })
      onChanged(res)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Změnit službu" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          Nyní: <b>{currentTitle || '—'}</b>
          {booking.totalPrice != null && <span className="text-gray-400"> · {booking.totalPrice} Kč</span>}
        </div>

        <Section title="Nová služba">
          <ServicePicker catalog={catalog} sel={sel} onChange={setSel} />
        </Section>

        {pricing && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-sm text-gray-600">
              {pricing.durationMin} min
              {tier === 'junior' && (
                <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                  junior −{JUNIOR_DISCOUNT_PERCENT} %
                </span>
              )}
            </span>
            <span className="flex items-baseline gap-2">
              {tier === 'junior' && pricing.seniorPrice !== pricing.price && (
                <span className="text-xs text-gray-400 line-through">{pricing.seniorPrice} Kč</span>
              )}
              <span className="text-base font-bold text-primary">{pricing.price} Kč</span>
            </span>
          </div>
        )}

        <div>
          <span className={labelCls}>Cena ručně (Kč)</span>
          <input
            className={inputCls}
            placeholder={pricing ? String(pricing.price) : ''}
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value)}
          />
          <p className="mt-0.5 text-[11px] text-gray-400">Prázdné → cena se přepočítá automaticky.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            disabled={!svc || submitting}
            onClick={submit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? 'Ukládám…' : 'Změnit službu'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ── «+ Blok» ──

interface NewBlockProps {
  employees: CalendarEmployee[]
  initial: { employeeDocId?: string; date: string; startMin?: number }
  onClose: () => void
  onCreated: () => void
}

export const NewBlockModal = ({ employees, initial, onClose, onCreated }: NewBlockProps) => {
  const [employeeDocId, setEmployeeDocId] = useState(initial.employeeDocId || employees[0]?.docId || '')
  const [date, setDate] = useState(initial.date)
  const [fromTime, setFromTime] = useState(initial.startMin != null ? fmtHM(initial.startMin) : '09:00')
  const [toTime, setToTime] = useState(initial.startMin != null ? fmtHM(initial.startMin + 60) : '10:00')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // повтор
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none')
  const [until, setUntil] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([])

  const onRepeatChange = (r: 'none' | 'daily' | 'weekly') => {
    setRepeat(r)
    if (r !== 'none' && !until) setUntil(addDays(date, r === 'weekly' ? 27 : 6))
    if (r === 'weekly' && weekdays.length === 0) setWeekdays([weekdayOf(date)])
  }
  const toggleWeekday = (v: number) =>
    setWeekdays((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))

  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  const timeValid = /^\d{2}:\d{2}$/.test(fromTime) && /^\d{2}:\d{2}$/.test(toTime) && toMin(toTime) > toMin(fromTime)
  const untilValid = /^\d{4}-\d{2}-\d{2}$/.test(until) && until >= date
  const recurrenceValid = repeat === 'none' || (untilValid && (repeat === 'daily' || weekdays.length > 0))
  const valid = timeValid && recurrenceValid

  // предпросмотр числа блоков (зеркало _expandBlockDates)
  const occurrences = useMemo(() => {
    if (repeat === 'none') return 1
    if (!untilValid) return 0
    const wds = repeat === 'weekly' ? (weekdays.length ? weekdays : [weekdayOf(date)]) : null
    let count = 0
    for (
      let t = new Date(`${date}T00:00:00Z`);
      t <= new Date(`${until}T00:00:00Z`) && count < 400;
      t.setUTCDate(t.getUTCDate() + 1)
    ) {
      if (repeat === 'daily' || wds!.includes(t.getUTCDay())) count++
    }
    return count
  }, [repeat, until, date, weekdays, untilValid])

  const submit = async () => {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      await engineCreateBlock({
        employee: employeeDocId,
        date,
        startMin: toMin(fromTime),
        endMin: toMin(toTime),
        title: title.trim() || undefined,
        recurrence:
          repeat === 'none'
            ? undefined
            : {
                freq: repeat,
                until,
                weekdays: repeat === 'weekly' ? (weekdays.length ? weekdays : [weekdayOf(date)]) : undefined,
              },
      })
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Nový blok" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className={labelCls}>Mistr</span>
            <select className={inputCls} value={employeeDocId} onChange={(e) => setEmployeeDocId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.docId} value={e.docId}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={labelCls}>Datum</span>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Od</span>
            <input type="time" step={900} className={inputCls} value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Do</span>
            <input type="time" step={900} className={inputCls} value={toTime} onChange={(e) => setToTime(e.target.value)} />
          </div>
        </div>
        <div>
          <span className={labelCls}>Důvod (volitelné)</span>
          <input className={inputCls} placeholder="školení / dovolená / oběd…" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* Повтор */}
        <Section title="Opakování">
          <div>
            <select className={inputCls} value={repeat} onChange={(e) => onRepeatChange(e.target.value as 'none' | 'daily' | 'weekly')}>
              <option value="none">Neopakovat</option>
              <option value="daily">Každý den</option>
              <option value="weekly">Vybrané dny v týdnu</option>
            </select>
          </div>

          {repeat === 'weekly' && (
            <div>
              <span className={labelCls}>Dny v týdnu</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w.v}
                    type="button"
                    onClick={() => toggleWeekday(w.v)}
                    className={`h-8 w-9 rounded-md border text-xs font-semibold transition ${
                      weekdays.includes(w.v)
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {repeat !== 'none' && (
            <div>
              <span className={labelCls}>Opakovat do</span>
              <input type="date" className={inputCls} min={date} value={until} onChange={(e) => setUntil(e.target.value)} />
              <p className="mt-1 text-[10px] leading-tight text-gray-400">
                {occurrences > 0
                  ? `Vytvoří se ${occurrences} ${blokPlural(occurrences)}.`
                  : 'Vyberte datum konce (musí být po začátku).'}
              </p>
            </div>
          )}
        </Section>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Zrušit
          </button>
          <button
            type="button"
            disabled={!valid || submitting}
            onClick={submit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? 'Vytvářím…' : 'Vytvořit blok'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ── управление существующим блоком (клик по серому блоку в гриде) ──

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

  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
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
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <b>{masterName}</b> · {date}
          {!block.own && (
            <p className="mt-1 text-xs text-amber-600">Blok pochází ze synchronizace Noona.</p>
          )}
          {seriesCount > 1 && (
            <p className="mt-1 text-xs text-gray-500">Součást série — celkem {seriesCount} {blokPlural(seriesCount)}.</p>
          )}
        </div>

        {/* правка этого конкретного блока */}
        <Section title="Upravit tento blok">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className={labelCls}>Od</span>
              <input type="time" step={900} className={inputCls} value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
            </div>
            <div>
              <span className={labelCls}>Do</span>
              <input type="time" step={900} className={inputCls} value={toTime} onChange={(e) => setToTime(e.target.value)} />
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
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Smazat tento blok
            </button>
            {seriesCount > 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={removeSeries}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Smazat celou sérii ({seriesCount})
              </button>
            )}
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

// ── подтверждение переноса брони (drag-and-drop) ──

export interface MovePending {
  booking: CalendarBooking
  employeeDocId: string
  date: string
  time: string
  fromLabel: string // «14:00 · Yana» (старый термин)
  toLabel: string // «11:30 · 12. 7. · Karina» (новый)
  masterChanged: boolean
}

interface MoveModalProps {
  pending: MovePending
  onClose: () => void
  onConfirm: (notifyClient: boolean) => void
  busy: boolean
}

export const MoveBookingModal = ({ pending, onClose, onConfirm, busy }: MoveModalProps) => {
  const hasEmail = Boolean(pending.booking.client?.email?.trim())
  const [notifyClient, setNotifyClient] = useState(hasEmail)

  return (
    <ModalShell title="Přesunout rezervaci" onClose={onClose}>
      <div className="space-y-4">
        {/* что и куда */}
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
          <div className="mb-1.5 font-semibold text-gray-900">{pending.booking.clientNameRaw || 'Klient'}</div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className="text-gray-400 line-through">{pending.fromLabel}</span>
            <span className="text-primary">→</span>
            <span className="font-semibold text-gray-900">{pending.toLabel}</span>
          </div>
        </div>

        {/* уведомление клиента */}
        <Section title="Oznámení">
          {hasEmail ? (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-gray-300">
              <input
                type="checkbox"
                checked={notifyClient}
                onChange={(e) => setNotifyClient(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              Poslat klientovi e-mail o změně termínu
            </label>
          ) : (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-400">
              Klient nemá e-mail — oznámení nelze odeslat.
            </p>
          )}
          {/* уведомление мастеру — отдельная задача, добавим позже */}
        </Section>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Zrušit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(notifyClient && hasEmail)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Přesouvám…' : 'Přesunout'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ── «Spravovat štítky» (справочник кастомных лейблов броней, как stavy в Noona) ──

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
