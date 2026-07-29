// Закрытие визита из drawer календаря («Uzavřít návštěvu», вариант D2).
//
// Раньше «✓ Proběhla» просто ставила брони статус checkedOut, а запись «Оказанная
// услуга» админ заводил руками в Strapi CM (имя клиента текстом → опечатки → ложные
// ±2 при сверке смены, услугу и мастера выбирал заново). Теперь кнопка открывает эту
// форму: клиент/мастер/услуга/дата берутся из брони, руками вводятся ТОЛЬКО деньги.
//
// Суммы НЕ автозаполняются осознанно (решение владельца s142, подтверждение s83):
// подсказка показывает расчёт, но ввод остаётся ручным — иначе verify-флаги всегда
// были бы 🟩 и потеряли смысл контроля.
//
// Компонент сам ходит в движок (паттерн LoyaltyCard): GET подсказки/записи,
// POST/PATCH/DELETE чекаута. Смену статуса брони делает сервер — наверх уходит
// только колбэк, чтобы CalendarPage обновил selected и перезагрузил сетку.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarBooking } from './fetch/calendarDay'
import {
  type PayableVoucher,
  type VisitCheckout,
  type VisitCheckoutHint,
  engineCheckout,
  engineCheckoutDelete,
  engineCheckoutPatch,
  fetchPayableVouchers,
  fetchVisitCheckout,
} from './fetch/engineApi'
import { FLAG_META, type VerifyFlag, parseSaleRate } from '../../lib/verifyFlags'

const round2 = (n: number) => Math.round(n * 100) / 100
const fmtKc = (n: number) => `${round2(n)} Kč`

const inputCls =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:text-gray-300 dark:placeholder:text-gray-500'
const labelTextCls = 'text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400'
const labelCls = `mb-1 block ${labelTextCls}`
// Чип «сколько по прайсу» рядом с подписью поля. Только показывает число —
// клика/автозаполнения намеренно нет (иначе verify-флаги всегда 🟩, s142/s83).
const hintChipCls =
  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none text-pink-700 bg-pink-100 dark:bg-[#e71e6e26] dark:text-[#ff8ab6]'

/** Чипы verify-флагов (та же палитра, что в закрытии смены). */
const FlagChips = ({ flags }: { flags: string[] }) => (
  <div className="flex flex-wrap gap-1">
    {flags.map((f) => {
      const meta = FLAG_META[f as VerifyFlag]
      if (!meta) return null
      return (
        <span key={f} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.chipCls}`}>
          {meta.emoji} {meta.label}
        </span>
      )
    })}
  </div>
)

type FormState = {
  staff: string
  salon: string
  tip: string
  sale: string
  cash: boolean
  internal: boolean
  voucherDocId: string
  comment: string
}

const EMPTY_FORM: FormState = {
  staff: '',
  salon: '',
  tip: '',
  sale: '',
  cash: true,
  internal: false,
  voucherDocId: '',
  comment: '',
}

const isNum = (s: string) => {
  const t = s.trim().replace(',', '.')
  return t !== '' && Number.isFinite(Number(t))
}

export const VisitCloseSection = ({
  b,
  busy,
  open,
  onOpenChange,
  onHasCheckout,
  onClosed,
  onReopened,
}: {
  b: CalendarBooking
  busy: boolean
  // форма открыта извне (кнопка «✓ Proběhla» в футере drawer)
  open: boolean
  onOpenChange: (open: boolean) => void
  // есть ли уже запись о закрытии — футер по этому флагу прячет «↩ Obnovit»
  onHasCheckout: (has: boolean) => void
  // визит закрыт (бронь → checkedOut) / закрытие отменено (бронь → active)
  onClosed: () => void
  onReopened: () => void
}) => {
  const [checkout, setCheckout] = useState<VisitCheckout | null>(null)
  const [hint, setHint] = useState<VisitCheckoutHint | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [vouchers, setVouchers] = useState<PayableVoucher[]>([])
  const boxRef = useRef<HTMLDivElement | null>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }))

  // Подсказка/запись зависят от цены брони — рефетч и после применения скидок
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchVisitCheckout(b.documentId)
      .then((res) => {
        if (cancelled) return
        setCheckout(res.checkout)
        setHint(res.hint)
        onHasCheckout(Boolean(res.checkout))
      })
      .catch(() => {
        if (cancelled) return
        setCheckout(null)
        setHint(null)
        onHasCheckout(false)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [b.documentId, b.totalPrice, b.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Смена брони — сбрасываем локальное состояние формы (drawer не размонтируется)
  useEffect(() => {
    setForm(EMPTY_FORM)
    setEditing(false)
    setConfirmUndo(false)
    setError(null)
  }, [b.documentId])

  const formOpen = (open && !checkout) || editing

  // Ваучеры тянем лениво — только когда форма реально открыта
  useEffect(() => {
    if (!formOpen || vouchers.length) return
    fetchPayableVouchers()
      .then(setVouchers)
      .catch(() => setVouchers([]))
  }, [formOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Открыли форму — прокручиваем к ней (кнопка-триггер живёт в футере ниже)
  useEffect(() => {
    if (formOpen) boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [formOpen])

  const startEdit = useCallback(() => {
    if (!checkout) return
    setForm({
      staff: checkout.staffSalaries || '',
      salon: checkout.salonSalaries || '',
      tip: checkout.tip || '',
      sale: checkout.sale || '',
      cash: checkout.cash,
      internal: checkout.internal,
      voucherDocId: checkout.voucher?.documentId || '',
      comment: checkout.comment || '',
    })
    setError(null)
    setEditing(true)
  }, [checkout])

  const closeForm = () => {
    setEditing(false)
    onOpenChange(false)
    setError(null)
  }

  const submit = async () => {
    if (!isNum(form.staff) || !isNum(form.salon)) {
      setError('Vyplňte cenu mistra i zisk salonu (čísla).')
      return
    }
    if (form.tip.trim() && !isNum(form.tip)) {
      setError('Spropitné musí být číslo.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        staffSalaries: form.staff.trim().replace(',', '.'),
        salonSalaries: form.salon.trim().replace(',', '.'),
        tip: form.tip.trim() ? form.tip.trim().replace(',', '.') : null,
        sale: form.sale.trim() || null,
        cash: form.cash,
        internal: form.internal,
        voucherDocId: form.voucherDocId || null,
        comment: form.comment.trim() || null,
      }
      const res = editing && checkout
        ? await engineCheckoutPatch(checkout.documentId, payload)
        : await engineCheckout(b.documentId, payload)
      setCheckout(res.checkout)
      onHasCheckout(true)
      setEditing(false)
      onOpenChange(false)
      if (!editing) onClosed()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const undo = async () => {
    if (!checkout) return
    setSaving(true)
    setError(null)
    try {
      await engineCheckoutDelete(checkout.documentId)
      setCheckout(null)
      setConfirmUndo(false)
      // форму сбрасываем: следующий «✓ Proběhla» должен открыться пустым,
      // а не с суммами отменённого закрытия
      setForm(EMPTY_FORM)
      onHasCheckout(false)
      onReopened()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Живой пересчёт подсказки: ручная скидка вычитается из ожидаемой оплаты
  // (мастер всегда получает свой процент от полной цены — скидку ест салон, s47)
  const saleKc = hint ? hint.fullPrice * parseSaleRate(form.sale, hint.fullPrice) : 0
  const mustStaff = hint ? hint.mustStaff : 0
  const mustSalon = hint ? round2(hint.paidExpected - saleKc - mustStaff) : 0

  const discountParts: string[] = []
  if (hint && hint.systemDiscountKc > 0) discountParts.push(`systémová sleva −${Math.round(hint.systemDiscountKc)} Kč`)
  if (saleKc > 0) discountParts.push(`ruční sleva −${Math.round(saleKc)} Kč`)

  if (loading) return null
  // Ни записи, ни открытой формы — секции нет (drawer остаётся компактным)
  if (!checkout && !formOpen) return null

  const disabled = busy || saving

  return (
    <div ref={boxRef} className="mt-3 rounded-xl border border-gray-400 p-3 dark:border-[#2e2e2c]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {checkout && !editing ? 'Návštěva uzavřena' : 'Uzavřít návštěvu'}
        </span>
        {checkout && !editing && <FlagChips flags={checkout.verifyFlags} />}
      </div>

      {/* ── закрытый визит: суммы + действия ── */}
      {checkout && !editing && (
        <>
          <div className="space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-[#252523]">
            <div className="flex justify-between gap-2">
              <span className="text-gray-600 dark:text-gray-400">Cena mistra</span>
              <b className="text-gray-800 dark:text-gray-200">{checkout.staffSalaries} Kč</b>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-600 dark:text-gray-400">Zisk salonu</span>
              <b className="text-gray-800 dark:text-gray-200">{checkout.salonSalaries} Kč</b>
            </div>
            {checkout.tip && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-600 dark:text-gray-400">Spropitné</span>
                <b className="text-gray-800 dark:text-gray-200">{checkout.tip} Kč</b>
              </div>
            )}
            {checkout.sale && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-600 dark:text-gray-400">Sleva</span>
                <b className="text-gray-800 dark:text-gray-200">{checkout.sale}</b>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-gray-700 dark:bg-[#3a3a38] dark:text-gray-300">
                {checkout.cash ? 'Hotově' : 'Kartou'}
              </span>
              {checkout.internal && (
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800">🤝 Interní</span>
              )}
              {checkout.voucher && (
                <span className="rounded bg-pink-100 px-1.5 py-0.5 text-pink-800">
                  🎟 #{checkout.voucher.idVoucher}
                </span>
              )}
            </div>
          </div>

          {checkout.published ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Směna je už uzavřená — záznam lze upravit jen ve Strapi.
            </p>
          ) : confirmUndo ? (
            <div className="mt-2 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Zrušit uzavření návštěvy?
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Záznam o provedené službě se smaže a rezervace se vrátí mezi aktivní.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={undo}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
                >
                  Potvrdit
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setConfirmUndo(false)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
                >
                  Zpět
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={startEdit}
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:bg-transparent dark:text-gray-300 dark:shadow-none dark:hover:bg-[#2e2e2c]"
              >
                Upravit
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setConfirmUndo(true)}
                className="flex-1 rounded-md border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-40 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-500/10"
              >
                Zrušit uzavření
              </button>
            </div>
          )}
        </>
      )}

      {/* ── форма (создание или правка) ── */}
      {formOpen && (
        <>
          {hint && (
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-[#252523]">
              {/* без скидок полная цена = к оплате → одно число, не дублируем */}
              <span className="text-gray-600 dark:text-gray-400">
                {discountParts.length ? (
                  <>
                    Cena služeb <b className="text-gray-800 dark:text-gray-200">{fmtKc(hint.fullPrice)}</b>
                    {` · ${discountParts.join(' · ')}`}
                  </>
                ) : (
                  'Cena služeb · bez slev'
                )}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                K zaplacení <b className="text-sm text-primary">{fmtKc(hint.paidExpected - saleKc)}</b>
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className={labelTextCls}>Cena mistra *</span>
                {hint && (
                  <span className={hintChipCls} title={`Podle ceníku · ${hint.ratePercent} % z ceny služeb`}>
                    {round2(mustStaff)}
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={form.staff}
                onChange={(e) => set('staff', e.target.value)}
                placeholder={hint ? String(round2(mustStaff)) : ''}
                className={inputCls}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className={labelTextCls}>Zisk salonu *</span>
                {hint && (
                  <span className={hintChipCls} title="Podle ceníku · zbytek po ceně mistra a slevách">
                    {round2(mustSalon)}
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={form.salon}
                onChange={(e) => set('salon', e.target.value)}
                placeholder={hint ? String(round2(mustSalon)) : ''}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Spropitné</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.tip}
                onChange={(e) => set('tip', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Sleva</label>
              <input
                type="text"
                value={form.sale}
                onChange={(e) => set('sale', e.target.value)}
                placeholder="20 % nebo 400"
                className={inputCls}
              />
            </div>
          </div>

          <div className="mt-2">
            <label className={labelCls}>Voucher</label>
            <select
              value={form.voucherDocId}
              onChange={(e) => set('voucherDocId', e.target.value)}
              className={`${inputCls} dark:[color-scheme:dark]`}
            >
              <option value="">— bez voucheru —</option>
              {vouchers.map((v) => (
                <option key={v.documentId} value={v.documentId}>
                  #{v.idVoucher} · {v.sum} Kč · {v.for || v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2">
            <label className={labelCls}>Poznámka</label>
            <textarea
              rows={2}
              value={form.comment}
              onChange={(e) => set('comment', e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.cash}
                onChange={(e) => set('cash', e.target.checked)}
                className="accent-primary"
              />
              Hotově
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.internal}
                onChange={(e) => set('internal', e.target.checked)}
                className="accent-primary"
              />
              Interní (mistr mistrové)
            </label>
          </div>

          {error && (
            <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={submit}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-40"
            >
              {saving ? 'Ukládám…' : editing ? 'Uložit změny' : 'Uzavřít návštěvu'}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={closeForm}
              className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
            >
              Zpět
            </button>
          </div>
        </>
      )}
    </div>
  )
}
