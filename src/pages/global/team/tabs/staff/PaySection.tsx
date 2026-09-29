import { useState } from 'react'
import { Link } from 'react-router-dom'
import { badgeMutedCls, badgeWarnCls, btnNeutralCls, btnPinkCls, hintCls, inputCls, labelCls } from '../../../../../ui/kit'
import { addDaysYmd, fmtCsDate, todayYmd } from '../../../../../utils/date'
import { kc } from '../../../../../utils/money'
import {
  addStaffRate,
  fmtYm,
  monthStartOf,
  patchStaff,
  rateText,
  savePayrollGroup,
  type PayrollGroup,
  type StaffCard,
  type TypeWork,
} from '../../fetch/staff'
import { EditButton, ErrorLine, Field, SectionCard } from './ui'

const INT = /^\d+$/

// Секция «Оплата». Доля мастера и порог — правятся; ставки — только «новая с даты»:
// прошлые записи не меняются (часы × ставка считаются на лету — правка задним
// числом переписала бы посчитанные месяцы).
export function PaySection({ card, onCard }: { card: StaffCard; onCard: (c: StaffCard) => void }) {
  const p = card.pay
  const master = card.position === 'master'
  const [edit, setEdit] = useState(false)
  const [percent, setPercent] = useState('')
  const [threshold, setThreshold] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateOpen, setRateOpen] = useState(false)

  const startEdit = () => {
    setPercent(p.ratePercent == null ? '' : String(p.ratePercent))
    setThreshold(String(p.excessThreshold ?? 0))
    setError(null)
    setEdit(true)
  }

  const data: Record<string, number> = {}
  if (master && INT.test(percent) && Number(percent) !== p.ratePercent) data.ratePercent = Number(percent)
  if (INT.test(threshold) && Number(threshold) !== p.excessThreshold) data.excessThreshold = Number(threshold)
  const bad = (master && percent !== '' && (!INT.test(percent) || Number(percent) > 100)) || !INT.test(threshold)
  const dirty = !bad && Object.keys(data).length > 0

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    try {
      onCard(await patchStaff(card.documentId, 'pay', data, card.updatedAt))
      setEdit(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const rates = [...p.rates].reverse()

  return (
    <SectionCard title="Оплата" testId="staff-pay" action={!edit && !card.left && <EditButton onClick={startEdit} />}>
      {!edit ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {master && (
            <Field label="Доля мастера">
              {p.ratePercent == null ? <span className={badgeWarnCls}>не задана</span> : `${p.ratePercent} %`}
            </Field>
          )}
          <Field label="Порог превышения">{kc(p.excessThreshold ?? 0)}</Field>
          <Field label="Ставка сейчас">
            {p.currentRate ? rateText(p.currentRate) : master ? '—' : <span className={badgeWarnCls}>не задана</span>}
          </Field>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {master && (
              <label className="block">
                <span className={labelCls}>Доля мастера, %</span>
                <input name="ratePercent" type="number" min={0} max={100} className={`${inputCls} w-full`} value={percent} onChange={(e) => setPercent(e.target.value)} />
              </label>
            )}
            <label className="block">
              <span className={labelCls}>Порог превышения, Kč</span>
              <input name="excessThreshold" type="number" min={0} className={`${inputCls} w-full`} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </label>
          </div>
          <div className={`mt-2 ${hintCls}`}>
            {master ? 'Доля применяется при закрытии визита. ' : ''}
            Сумма к выплате сверх порога показывается в зарплатах как «превышение».
          </div>
          <ErrorLine text={error} />
          <div className="mt-4 flex gap-2">
            <button type="button" className={btnPinkCls} onClick={save} disabled={!dirty || saving}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button type="button" className={btnNeutralCls} onClick={() => setEdit(false)} disabled={saving}>
              Отмена
            </button>
          </div>
        </>
      )}

      {p.group && <PayrollGroupBlock card={card} group={p.group} onCard={onCard} />}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <span className={labelCls}>История ставок</span>
          {!card.left && !rateOpen && (
            <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={() => setRateOpen(true)}>
              + Новая ставка с даты
            </button>
          )}
        </div>
        {rateOpen && <NewRateForm card={card} onCard={onCard} onClose={() => setRateOpen(false)} />}
        {rates.length === 0 ? (
          <div className="text-[13px] font-semibold text-ink-faint">Ставок нет.</div>
        ) : (
          <ul className="m-0 p-0 list-none" data-testid="staff-rates">
            {rates.map((r, i) => (
              <li key={`${r.from}-${i}`} className={`flex items-center gap-3 flex-wrap py-2 ${i ? 'border-t border-line-soft' : ''}`}>
                <span className="text-[13.5px] font-bold text-ink">{rateText(r)}</span>
                <span className="text-[12.5px] font-semibold text-ink-soft">
                  {fmtCsDate(r.from)} — {r.to ? fmtCsDate(r.to) : 'сейчас'}
                </span>
                {!r.to && <span className={badgeMutedCls}>действует</span>}
              </li>
            ))}
          </ul>
        )}
        <div className={`mt-2 ${hintCls}`}>
          Прошлые ставки не правятся. Расчёт зарплат —{' '}
          <Link to="/global/team/salaries" className="font-semibold text-brand-dark underline">
            «Зарплаты»
          </Link>
          .
        </div>
      </div>
    </SectionCard>
  )
}

function NewRateForm({ card, onCard, onClose }: { card: StaffCard; onCard: (c: StaffCard) => void; onClose: () => void }) {
  const today = todayYmd()
  const minFrom = monthStartOf(today)
  const last = card.pay.rates.map((r) => r.from || '').sort().pop() || ''
  const [typeWork, setTypeWork] = useState<TypeWork>(card.pay.currentRate?.typeWork ?? (card.position === 'manager' ? 'hpp' : 'dpp'))
  const [rate, setRate] = useState('')
  const [hourly, setHourly] = useState('')
  const [from, setFrom] = useState(today > last ? today : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fromOk = /^\d{4}-\d{2}-\d{2}$/.test(from) && from >= minFrom && (!last || from > last)
  const canSave = !saving && INT.test(rate) && Number(rate) > 0 && (hourly === '' || INT.test(hourly)) && fromOk
  const open = card.pay.rates.filter((r) => !r.to || r.to >= from)

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const input = { typeWork, rate: Number(rate), from, ...(typeWork === 'hpp' && hourly ? { hourlyRate: Number(hourly) } : {}) }
      onCard(await addStaffRate(card.documentId, input, card.updatedAt))
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-line px-4 py-3" data-testid="staff-new-rate">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <label className="block">
          <span className={labelCls}>Договор</span>
          <select name="typeWork" className={`${inputCls} w-full`} value={typeWork} onChange={(e) => setTypeWork(e.target.value as TypeWork)}>
            <option value="dpp">DPP — почасовая</option>
            <option value="hpp">HPP — оклад</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>{typeWork === 'hpp' ? 'Оклад, Kč/мес' : 'Ставка, Kč/час'}</span>
          <input name="rate" type="number" min={1} className={`${inputCls} w-full`} value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        {typeWork === 'hpp' && (
          <label className="block">
            <span className={labelCls}>+ Kč/час (необяз.)</span>
            <input name="hourlyRate" type="number" min={1} className={`${inputCls} w-full`} value={hourly} onChange={(e) => setHourly(e.target.value)} />
          </label>
        )}
        <label className="block">
          <span className={labelCls}>С даты</span>
          <input name="from" type="date" min={minFrom} className={`${inputCls} w-full`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
      </div>
      <div className={`mt-2 ${hintCls}`}>
        Не раньше {fmtCsDate(minFrom)}
        {last ? ` и позже начала последней ставки (${fmtCsDate(last)})` : ''}.
        {fromOk && open.length > 0 && ` Действующая ставка закроется ${fmtCsDate(addDaysYmd(from, -1))}.`}
      </div>
      <ErrorLine text={error} />
      <div className="mt-3 flex gap-2">
        <button type="button" className={btnPinkCls} onClick={save} disabled={!canSave}>
          {saving ? 'Сохраняю…' : 'Добавить ставку'}
        </button>
        <button type="button" className={btnNeutralCls} onClick={onClose} disabled={saving}>
          Отмена
        </button>
      </div>
    </div>
  )
}

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/

const dualText = (g: PayrollGroup) =>
  !g.dualRole ? 'нет' : g.dualRoleUntil ? `да — по ${fmtYm(g.dualRoleUntil)} включительно` : 'да — бессрочно'

// Зарплатная группа (s229, §5а.2): раньше — списки имён в коде (teamSplit.ts). Правится и у
// ушедших: прошлые месяцы совмещения считаются по ней же.
function PayrollGroupBlock({ card, group, onCard }: { card: StaffCard; group: PayrollGroup; onCard: (c: StaffCard) => void }) {
  const manager = card.position === 'manager'
  const [edit, setEdit] = useState(false)
  const [dual, setDual] = useState(group.dualRole)
  const [until, setUntil] = useState(group.dualRoleUntil ?? '')
  const [since, setSince] = useState(group.managerSince ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    setDual(group.dualRole)
    setUntil(group.dualRoleUntil ?? '')
    setSince(group.managerSince ?? '')
    setError(null)
    setEdit(true)
  }

  const data: Partial<PayrollGroup> = {}
  if (dual !== group.dualRole) data.dualRole = dual
  const untilNext = dual ? until || null : null
  if (dual && untilNext !== group.dualRoleUntil) data.dualRoleUntil = untilNext
  const sinceNext = since || null
  if (sinceNext !== group.managerSince) data.managerSince = sinceNext
  const bad = (dual && until !== '' && !YM_RE.test(until)) || (since !== '' && !YM_RE.test(since)) || (!!sinceNext && !manager)
  const dirty = !bad && Object.keys(data).length > 0

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    try {
      onCard(await savePayrollGroup(card.documentId, data, card.updatedAt))
      setEdit(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const showManager = manager || !!group.managerSince
  return (
    <div className="mt-5 rounded-lg border border-line px-4 py-3" data-testid="staff-payroll-group">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <span className={labelCls}>Зарплатная группа</span>
        {!edit && <EditButton onClick={start} />}
      </div>
      {!edit ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Совместитель (мастер + администратор)">{dualText(group)}</Field>
          {showManager && (
            <Field label="Управляющая (оклад)">
              {group.managerSince ? `с ${fmtYm(group.managerSince)}` : <span className={badgeWarnCls}>не задано</span>}
            </Field>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <label className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
              <input name="dualRole" type="checkbox" checked={dual} onChange={(e) => setDual(e.target.checked)} />
              Совместитель (мастер + администратор)
            </label>
            {dual && (
              <label className="block">
                <span className={labelCls}>Последний месяц совмещения (пусто — бессрочно)</span>
                <input name="dualRoleUntil" type="month" className={`${inputCls} w-full`} value={until} onChange={(e) => setUntil(e.target.value)} />
              </label>
            )}
            {showManager && (
              <label className="block">
                <span className={labelCls}>Управляющая с месяца</span>
                <input name="managerSince" type="month" className={`${inputCls} w-full`} value={since} onChange={(e) => setSince(e.target.value)} />
              </label>
            )}
          </div>
          <div className="mt-2 text-[12.5px] font-semibold text-neg" data-testid="staff-payroll-group-warning">
            Меняет расчёт зарплат ВСЕХ месяцев, где группа действует, — и прошлых тоже. Совместителю корректировки
            считаются один раз; снять совмещение с месяцев, где были и услуги, и смены, — значит задвоить их.
          </div>
          <ErrorLine text={error} />
          <div className="mt-3 flex gap-2">
            <button type="button" className={btnPinkCls} onClick={save} disabled={!dirty || saving}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button type="button" className={btnNeutralCls} onClick={() => setEdit(false)} disabled={saving}>
              Отмена
            </button>
          </div>
        </>
      )}
    </div>
  )
}
