// Модалы календаря-write: «+ Rezervace» (walk-in бронь админом — поиск клиента,
// пикер услуги/варианта/допов из salon-service, цена по tier мастера, override)
// и «+ Blok» (нерабочее время). Всё пишет в наш движок (/api/engine/admin/*).

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEmployee } from './fetch/calendarDay'
import type { CatalogService, ClientHit } from './fetch/engineApi'
import {
  calcCombo,
  engineCreateBlock,
  engineCreateBooking,
  fetchCatalog,
  searchClients,
} from './fetch/engineApi'

const fmtHM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

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
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
)

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
  const [serviceDocId, setServiceDocId] = useState('')
  const [variantLabel, setVariantLabel] = useState('')
  const [modKeys, setModKeys] = useState<string[]>([])

  const [priceOverride, setPriceOverride] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const categories = useMemo(() => [...new Set(catalog.map((s) => s.category))], [catalog])
  const [category, setCategory] = useState('')
  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0])
  }, [categories, category])
  const services = useMemo(() => catalog.filter((s) => s.category === category), [catalog, category])
  useEffect(() => {
    // смена категории → первая её услуга; сброс варианта/допов
    if (services.length && !services.some((s) => s.documentId === serviceDocId)) {
      setServiceDocId(services[0].documentId)
      setVariantLabel('')
      setModKeys([])
    }
  }, [services, serviceDocId])

  const svc = catalog.find((s) => s.documentId === serviceDocId)
  const employee = employees.find((e) => e.docId === employeeDocId)

  const toggleMod = (key: string) => {
    if (!svc) return
    const mod = svc.modifiers.find((m) => m.key === key)
    setModKeys((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key)
      // взаимоисключающая группа: снимаем других из той же группы
      const sameGroup = mod?.group
        ? svc.modifiers.filter((m) => m.group === mod.group && m.key !== key).map((m) => m.key)
        : []
      return [...cur.filter((k) => !sameGroup.includes(k)), key]
    })
  }

  const pricing = svc ? calcCombo(svc, variantLabel || null, modKeys, employee?.tier || 'senior') : null
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
        services: [{ service: svc.documentId, variant: variantLabel || null, modifiers: modKeys }],
        ...(newClient
          ? { client: { name: ncName.trim(), phone: ncPhone.trim(), email: ncEmail.trim() || undefined } }
          : { clientDocId: client!.documentId }),
        priceOverride: priceOverride.trim() ? Number(priceOverride) : undefined,
        comment: comment.trim() || undefined,
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
      <div className="space-y-4">
        {/* Клиент */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className={labelCls}>Klient</span>
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
            <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
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
        </div>

        {/* Услуга */}
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
              value={serviceDocId}
              onChange={(e) => {
                setServiceDocId(e.target.value)
                setVariantLabel('')
                setModKeys([])
              }}
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
            <select className={inputCls} value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)}>
              <option value="">Základní varianta</option>
              {svc.variants.map((v) => (
                <option key={v.label} value={v.label}>
                  {v.label} (+{v.priceDiff} Kč{v.durationDiff ? ` · +${v.durationDiff} min` : ''})
                </option>
              ))}
            </select>
          </div>
        )}

        {svc && svc.modifiers.length > 0 && (
          <div>
            <span className={labelCls}>Doplňky</span>
            <div className="flex flex-wrap gap-1.5">
              {svc.modifiers.map((m) => {
                const active = modKeys.includes(m.key)
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMod(m.key)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                    title={m.group ? `Skupina: ${m.group}` : undefined}
                  >
                    {m.label} +{m.priceDiff} Kč
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Мастер + дата/время */}
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
            <input type="time" step={900} className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        {/* Итог */}
        {pricing && (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-600">
              {pricing.durationMin} min{endTime ? ` · do ${endTime}` : ''}
              {employee?.tier === 'junior' && (
                <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                  junior −20 %
                </span>
              )}
            </span>
            <span className="font-bold text-gray-900">
              {employee?.tier === 'junior' && (
                <span className="mr-1.5 text-xs font-normal text-gray-400 line-through">{pricing.seniorPrice} Kč</span>
              )}
              {pricing.price} Kč
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className={labelCls}>Cena ručně (Kč)</span>
            <input
              className={inputCls}
              placeholder={pricing ? String(pricing.price) : ''}
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
          <div>
            <span className={labelCls}>Poznámka</span>
            <input className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>

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

  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  const valid = /^\d{2}:\d{2}$/.test(fromTime) && /^\d{2}:\d{2}$/.test(toTime) && toMin(toTime) > toMin(fromTime)

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
      })
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Nový blok (nepracovní doba)" onClose={onClose}>
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
