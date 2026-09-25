// «+ Rezervace» — walk-in бронь админом: поиск/создание клиента, пикер услуги
// (ServicePicker), цена по tier мастера, override цены, e-mail подтверждение.
// Пишет в движок POST /api/engine/admin/bookings.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEmployee } from '../fetch/calendarDay'
import { fetchInternalRecipients, type InternalRecipient } from '../../../lib/personals'
import type { CatalogService, ClientHit } from '../fetch/engineApi'
import { calcCombo, engineCreateBooking, fetchCatalog, searchClients } from '../fetch/engineApi'
import {
  EMPTY_SERVICE_SELECTION,
  btnPrimaryCls,
  btnSecondaryCls,
  fmtHM,
  inputCls,
  labelCls,
  toMin,
  type ServiceSelection,
} from './helpers'
import { ServicePicker } from './ServicePicker'
import { ModalShell, Section, TimeSelect } from './ui'

export interface NewBookingInitial {
  employeeDocId?: string
  date: string
  time?: string
}

// Контекст «влезает ли служба в свободное время»: занятые интервалы каждой колонки
// (ключ `employeeDocId|date`) + конец окна салона. Модал сам считает свободные минуты.
export interface SlotFitContext {
  closeMin: number
  busyByKey: Record<string, { startMin: number; endMin: number }[]>
}

interface NewBookingProps {
  employees: CalendarEmployee[]
  initial: NewBookingInitial
  slotFit?: SlotFitContext | null
  onClose: () => void
  onCreated: () => void
}

export const NewBookingModal = ({ employees, initial, slotFit, onClose, onCreated }: NewBookingProps) => {
  const [employeeDocId, setEmployeeDocId] = useState(initial.employeeDocId || employees[0]?.docId || '')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time || '10:00')

  // Режим записи (s203): обычная клиентская бронь либо «Interní» — запись
  // СОТРУДНИКА, которая не занимает время мастера. Третий режим, а не чекбокс:
  // у интерной брони нет клиента вовсе, и вся секция «Klient» заменяется селектором.
  const [internal, setInternal] = useState(false)
  const [recipients, setRecipients] = useState<InternalRecipient[]>([])
  const [recipientDocId, setRecipientDocId] = useState('')

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

  // Валидация нового клиента. Реальный кейс: два поля рядом с одними плейсхолдерами
  // админы читали как «имя | фамилие» → фамилия попадала в Telefon, телефон в E-mail,
  // а сервер отвечал 400 phone_required только после клика. Теперь у полей видимые
  // подписи + телефон обязан содержать номер (мин. 9 цифр — чешский формат; с кодом длиннее).
  const ncPhoneOk = ncPhone.replace(/\D/g, '').length >= 9
  const ncEmailTrim = ncEmail.trim()
  const ncEmailOk = !ncEmailTrim || /^\S+@\S+\.\S+$/.test(ncEmailTrim)

  // e-mail клиента (выбранного или нового) — гейт чекбокса «poslat potvrzení»
  const clientEmail = newClient ? (ncEmailOk ? ncEmailTrim : '') : (client?.email ?? '').trim()
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

  // список сотрудников тянем только когда он нужен (режим «Interní»)
  useEffect(() => {
    if (!internal || recipients.length) return
    fetchInternalRecipients()
      .then(setRecipients)
      .catch(() => setError('Nepodařilo se načíst seznam zaměstnanců'))
  }, [internal, recipients.length])

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
    return fmtHM(toMin(time) + pricing.durationMin)
  }, [pricing, time])

  // Свободные минуты от выбранного времени до ближайшей active-брони / блока / конца
  // окна салона (по данным колонки этого мастера на эту дату). Если служба не влезает —
  // предупреждаем в модале, но НЕ блокируем создание.
  const freeMin = useMemo(() => {
    if (!slotFit || !/^\d{2}:\d{2}$/.test(time)) return null
    const busy = slotFit.busyByKey[`${employeeDocId}|${date}`]
    if (!busy) return null // дата/мастер вне загруженного дня — подсказку не показываем
    const startMin = toMin(time)
    let limit = slotFit.closeMin
    for (const iv of busy) {
      if (iv.endMin <= startMin) continue
      // интервал накрывает старт → слот уже занят (0 свободных); иначе ограничивает сверху
      limit = Math.min(limit, iv.startMin <= startMin ? startMin : iv.startMin)
    }
    return Math.max(0, limit - startMin)
  }, [slotFit, employeeDocId, date, time])

  const overflow = pricing && freeMin != null && pricing.durationMin > freeMin ? freeMin : null

  const canSubmit =
    Boolean(employeeDocId && date && /^\d{2}:\d{2}$/.test(time) && svc) &&
    (internal
      ? Boolean(recipientDocId)
      : newClient
        ? Boolean(ncName.trim()) && ncPhoneOk && ncEmailOk
        : Boolean(client))

  // доля мастера и сумма списания с получателя — те же числа, что посчитает сервер
  // (internalPayrollSum: цена × ratePercent мастера, округление до кроны)
  const internalPrice = priceOverride.trim() ? Number(priceOverride) : (pricing?.price ?? null)
  const masterRate = employee?.ratePercent ?? null
  const internalOdpis =
    internal && internalPrice != null && masterRate != null
      ? Math.round((internalPrice * masterRate) / 100)
      : null

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
        // интерная бронь: клиента нет вовсе — ни поиска, ни создания карточки
        ...(internal
          ? { internal: true, internalFor: recipientDocId }
          : newClient
            ? { client: { name: ncName.trim(), phone: ncPhone.trim(), email: ncEmail.trim() || undefined } }
            : { clientDocId: client!.documentId }),
        priceOverride: priceOverride.trim() ? Number(priceOverride) : undefined,
        comment: comment.trim() || undefined,
        notify: !internal && notify && hasEmail,
      })
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title="Nová rezervace"
      onClose={onClose}
      footer={
        <>
          {error && <p className="mb-2 rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={btnSecondaryCls}>
              Zrušit
            </button>
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={submit}
              className={`${btnPrimaryCls} flex-1 sm:flex-none`}
            >
              {submitting ? 'Vytvářím…' : 'Vytvořit rezervaci'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-3">
        {/* ── Клиент ── */}
        <Section title={internal ? 'Zaměstnanec' : 'Klient'}>
          {/* Режим записи (s203). Пояснительный текст — только здесь: по правке
              владельца в макете, в календаре и на закрытии смены объяснений нет. */}
          <div className="mb-2 flex gap-1 rounded-md bg-gray-100 dark:bg-[#2a2a28] p-1" data-mode-switch>
            <button
              type="button"
              onClick={() => {
                setInternal(false)
                setRecipientDocId('')
              }}
              className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold transition ${
                internal ? 'text-gray-500 dark:text-gray-400' : 'bg-white dark:bg-[#3a3a37] text-ink dark:text-gray-100 shadow-sm'
              }`}
            >
              Klient
            </button>
            <button
              type="button"
              onClick={() => {
                setInternal(true)
                setClient(null)
                setNewClient(false)
              }}
              className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold transition ${
                internal ? 'bg-white dark:bg-[#3a3a37] text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              🤝 Interní
            </button>
          </div>

          {internal ? (
            <div className="space-y-2" data-internal-form>
              <p className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-xs text-indigo-800 dark:text-indigo-200">
                Rezervace pro zaměstnance. <b>Nezabírá čas mistrové</b> — na tento termín se
                může objednat i klientka. Salon si nebere nic, mistrová dostane své procento
                a stejná částka se zaměstnanci zapíše jako odpis ze mzdy.
              </p>
              <div>
                <span className={labelCls}>Pro koho *</span>
                <select className={inputCls} value={recipientDocId} onChange={(e) => setRecipientDocId(e.target.value)}>
                  <option value="">— vyberte zaměstnance —</option>
                  {recipients.map((r) => (
                    <option key={r.docId} value={r.docId}>
                      {r.name}
                      {r.position === 'administrator' ? ' (administrátorka)' : ''}
                      {r.position === 'manager' ? ' (vedoucí salonu)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {internalOdpis != null && (
                <div
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-[#2a2a28] px-3 py-2 text-sm"
                  data-internal-money
                >
                  <span className="whitespace-nowrap">
                    mistrová <b className="text-emerald-700 dark:text-emerald-300">{internalOdpis} Kč</b>
                  </span>
                  <span className="whitespace-nowrap">
                    odpis <b className="text-red-700 dark:text-red-300">−{internalOdpis} Kč</b>
                  </span>
                  <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">salon 0 Kč</span>
                </div>
              )}
              {internalOdpis == null && recipientDocId && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Vyberte službu — pak spočítáme podíl mistrové i odpis.
                </p>
              )}
            </div>
          ) : (
            <>
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
            <div className="space-y-2">
              <div>
                <span className={labelCls}>Jméno a příjmení *</span>
                <input className={inputCls} placeholder="Jana Nováková" value={ncName} onChange={(e) => setNcName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className={labelCls}>Telefon *</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    className={inputCls}
                    placeholder="+420 777 123 456"
                    value={ncPhone}
                    onChange={(e) => setNcPhone(e.target.value)}
                  />
                </div>
                <div>
                  <span className={labelCls}>E-mail</span>
                  <input
                    type="email"
                    inputMode="email"
                    className={inputCls}
                    placeholder="jana@email.cz"
                    value={ncEmail}
                    onChange={(e) => setNcEmail(e.target.value)}
                  />
                </div>
              </div>
              {ncPhone.trim() !== '' && !ncPhoneOk && (
                <p className="text-xs font-medium text-red-600 dark:text-red-300">
                  Do pole Telefon zadejte číslo — aspoň 9 číslic (např. +420 777 123 456).
                </p>
              )}
              {!ncEmailOk && (
                <p className="text-xs font-medium text-red-600 dark:text-red-300">
                  E-mail nevypadá platně — zkontrolujte ho, nebo pole nechte prázdné.
                </p>
              )}
            </div>
          ) : client ? (
            <div className="flex items-center justify-between rounded-md border border-gray-200 dark:border-[#2e2e2c] bg-white dark:bg-[#2a2a28] px-3 py-2 text-sm">
              <div>
                <b>{client.name}</b> <span className="text-gray-500 dark:text-gray-400">{client.phone}</span>
                {client.blacklisted && (
                  <span className="ml-2 rounded bg-red-100 dark:bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
                    BLACKLIST
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setClient(null)} className="text-gray-400 dark:text-gray-500 hover:text-red-500">
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
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 dark:border-[#2e2e2c] bg-white dark:bg-[#2a2a28] shadow-lg">
                  {hits.map((h) => (
                    <button
                      key={h.documentId}
                      type="button"
                      onClick={() => {
                        setClient(h)
                        setHits([])
                        setQuery('')
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#333331]"
                    >
                      <span>
                        {h.name}
                        {h.blacklisted && <span className="ml-1 text-[10px] font-bold text-red-600 dark:text-red-300">⛔</span>}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{h.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
            </>
          )}
        </Section>

        {/* ── Услуга ── */}
        <Section title="Služba">
          <ServicePicker catalog={catalog} sel={sel} onChange={setSel} employeeDocId={employee?.docId} />
        </Section>

        {/* ── Мастер + дата/время + итог ── */}
        <Section title="Termín">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
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
              <TimeSelect value={time} onChange={setTime} />
            </div>
          </div>

          {pricing && (
            <div className="flex items-center justify-between rounded-lg border border-[#e71e6e33] bg-[#e71e6e0d] px-3.5 py-2.5">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{pricing.durationMin} min</span>
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
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500 line-through">{pricing.seniorPrice} Kč</span>
                )}
                <span className="text-base font-bold leading-none text-primary">{pricing.price} Kč</span>
              </div>
            </div>
          )}

          {overflow != null && pricing && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <span className="text-sm leading-none">⚠</span>
              <span>
                Služba trvá <b>{pricing.durationMin} min</b>, ale do dalšího termínu je volných jen{' '}
                <b>{overflow === 0 ? '0 min (obsazeno)' : `${overflow} min`}</b>. Rezervaci lze přesto vytvořit —
                bude zasahovat do dalšího termínu.
              </span>
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
            <p className="mt-1 text-[10px] leading-tight text-gray-400 dark:text-gray-500">
              Vyplňte jen při individuální ceně. Prázdné = vypočtená ({pricing ? `${pricing.price} Kč` : '—'}).
            </p>
          </div>
          <div>
            <span className={labelCls}>Poznámka</span>
            <input className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>

          {/* Уведомление клиента (роадмап §4.3): письмо-подтверждение с ICS.
              У интерной брони адресата нет (client = NULL) — блок не показываем вовсе. */}
          {internal ? null : hasEmail ? (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-gray-200 dark:border-[#2e2e2c] bg-white dark:bg-[#2a2a28] px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-300">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              Poslat klientovi potvrzení e-mailem
            </label>
          ) : (
            <p className="rounded-md bg-gray-50 dark:bg-[#2a2a28] px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
              Klient nemá e-mail — potvrzení nelze odeslat.
            </p>
          )}
        </Section>

      </div>
    </ModalShell>
  )
}
