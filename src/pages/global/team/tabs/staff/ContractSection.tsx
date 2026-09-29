import { useState } from 'react'
import { badgeMutedCls, badgeWarnCls, btnDangerCls, btnNeutralCls, btnPinkCls, hintCls, inputCls, labelCls, selectCls } from '../../../../../ui/kit'
import { fmtCsDate, todayYmd } from '../../../../../utils/date'
import {
  CONTRACT_HINT,
  CONTRACT_LABEL,
  CONTRACT_TYPES,
  addStaffContract,
  contractText,
  deleteStaffContract,
  updateStaffContract,
  type ContractInput,
  type ContractType,
  type StaffCard,
  type StaffContract,
} from '../../fetch/staff'
import { ErrorLine, Field, OkLine, SectionCard } from './ui'

const WARNING_TEXT: Record<string, string> = {
  long_probation: 'Испытательный срок длиннее 3 месяцев — по закону так можно только у руководящих (до 6). Проверьте дату.',
}

// Секция «Договор» (фаза 2): только учёт — тип HPP / DPP / IČO, даты, испытательный срок,
// IČO у OSVČ, история. 🟥 На ставки и зарплаты договор не влияет: тип оплаты задаёт ставка
// в «Оплате». Прошлые договоры правятся (опечатки), удаляется только не начавшийся.
export function ContractSection({ card, onCard }: { card: StaffCard; onCard: (c: StaffCard) => void }) {
  const [form, setForm] = useState<{ mode: 'new' } | { mode: 'edit'; contract: StaffContract } | { mode: 'close'; contract: StaffContract } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!card.contracts) return null
  const { list, current } = card.contracts
  const today = todayYmd()
  const history = [...list].reverse()

  const remove = async (c: StaffContract) => {
    if (busy || c.id == null) return
    if (!window.confirm(`Удалить договор ${contractText(c)}? Он ещё не начался.`)) return
    setBusy(true)
    setError(null)
    setOk(null)
    setWarn(null)
    try {
      onCard(await deleteStaffContract(card.documentId, c.id, card.updatedAt))
      setOk('Договор удалён.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard
      title="Договор"
      testId="staff-contract"
      action={
        !form &&
        !card.left && (
          <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={() => setForm({ mode: 'new' })}>
            + Новый договор
          </button>
        )
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Field label="Сейчас">
          {current ? contractText(current) : <span className={badgeWarnCls}>договора нет</span>}
        </Field>
        {current?.type === 'hpp' && (
          <Field label="Испытательный срок">
            {current.probationUntil ? `до ${fmtCsDate(current.probationUntil)}${current.probationUntil < today ? ' (закончился)' : ''}` : '—'}
          </Field>
        )}
        {current?.type === 'ico' && <Field label="IČO">{current.ico || '—'}</Field>}
      </div>

      {form && (
        <ContractForm
          key={form.mode === 'new' ? 'new' : `${form.mode}-${form.contract.id}`}
          card={card}
          form={form}
          onDone={(c, msg, warning) => {
            onCard(c)
            setForm(null)
            setOk(msg)
            setWarn(warning)
          }}
          onCancel={() => setForm(null)}
        />
      )}

      <div className={`${labelCls} mt-5`}>История договоров</div>
      {history.length === 0 ? (
        <div className="text-[13px] font-semibold text-ink-faint">Договоров не внесено.</div>
      ) : (
        <ul className="m-0 p-0 list-none" data-testid="staff-contracts">
          {history.map((c, i) => {
            const started = c.from <= today
            return (
              <li key={c.id ?? i} data-contract={c.id ?? ''} className={`py-2 ${i ? 'border-t border-line-soft' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-bold text-ink">{contractText(c)}</span>
                  {current && c.id === current.id && <span className={badgeMutedCls}>действует</span>}
                  {!started && <span className={badgeMutedCls}>с {fmtCsDate(c.from)}</span>}
                  {c.type === 'hpp' && c.probationUntil && <span className={hintCls}>испытательный до {fmtCsDate(c.probationUntil)}</span>}
                  {c.type === 'ico' && c.ico && <span className={hintCls}>IČO {c.ico}</span>}
                  <span className="flex-1" />
                  {!card.left && !form && c.id != null && (
                    <>
                      {!c.to && started && (
                        <button type="button" className={`${btnNeutralCls} !px-2.5 !py-1`} disabled={busy} onClick={() => setForm({ mode: 'close', contract: c })}>
                          Закрыть датой
                        </button>
                      )}
                      <button type="button" className={`${btnNeutralCls} !px-2.5 !py-1`} disabled={busy} onClick={() => setForm({ mode: 'edit', contract: c })}>
                        Изменить
                      </button>
                      {!started && (
                        <button type="button" className={`${btnDangerCls} !px-2.5 !py-1`} disabled={busy} onClick={() => remove(c)}>
                          Удалить
                        </button>
                      )}
                    </>
                  )}
                </div>
                {c.note && <div className="mt-0.5 text-[12.5px] font-medium text-ink-body">{c.note}</div>}
              </li>
            )
          })}
        </ul>
      )}
      <div className={`mt-2 ${hintCls}`}>
        Договор — только учёт: на ставку и расчёт зарплат не влияет. Скан договора (у IČO — živnostenský list) — в «Документах».
      </div>
      <ErrorLine text={error} />
      <OkLine text={ok} />
      {warn && (
        <div role="alert" className="mt-2 text-[12.5px] font-semibold text-warn">
          {warn}
        </div>
      )}
    </SectionCard>
  )
}

function ContractForm({
  card,
  form,
  onDone,
  onCancel,
}: {
  card: StaffCard
  form: { mode: 'new' } | { mode: 'edit' | 'close'; contract: StaffContract }
  onDone: (c: StaffCard, msg: string, warning: string | null) => void
  onCancel: () => void
}) {
  const src = form.mode === 'new' ? null : form.contract
  const [type, setType] = useState<ContractType>(src?.type ?? 'dpp')
  const [from, setFrom] = useState(src?.from ?? card.hiredAt ?? todayYmd())
  const [to, setTo] = useState(src?.to ?? (form.mode === 'close' ? todayYmd() : ''))
  const [probation, setProbation] = useState(src?.probationUntil ?? '')
  const [ico, setIco] = useState(src?.ico ?? '')
  const [note, setNote] = useState(src?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const close = form.mode === 'close'

  const input = (): ContractInput => {
    if (close) return { to: to || null }
    return {
      type,
      from,
      to: to || null,
      probationUntil: type === 'hpp' ? probation || null : null,
      ico: type === 'ico' ? ico.replace(/\s/g, '') || null : null,
      note: note.trim() || null,
    }
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res =
        form.mode === 'new'
          ? await addStaffContract(card.documentId, input(), card.updatedAt)
          : await updateStaffContract(card.documentId, form.contract.id as number, input(), card.updatedAt)
      const warning = (res.warnings ?? []).map((w) => WARNING_TEXT[w] ?? w).join(' ')
      onDone(res, form.mode === 'new' ? 'Договор добавлен.' : 'Договор сохранён.', warning || null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const valid = close ? Boolean(to) : Boolean(from) && (type !== 'ico' || /^\d{8}$/.test(ico.replace(/\s/g, '')))

  return (
    <div className="mt-4 rounded-xl border border-line px-4 py-3.5" data-testid="staff-contract-form">
      <div className="text-[13.5px] font-extrabold text-ink mb-3">
        {form.mode === 'new' ? 'Новый договор' : close ? `Закрыть договор ${contractText(src)}` : `Изменить договор ${contractText(src)}`}
      </div>
      {close ? (
        <label className="block max-w-[220px]">
          <span className={labelCls}>Последний день договора</span>
          <input name="contractTo" type="date" className={`${inputCls} w-full`} value={to} min={src?.from} onChange={(e) => setTo(e.target.value)} />
        </label>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <label className="block">
            <span className={labelCls}>Тип</span>
            <select name="contractType" className={`${selectCls} w-full`} value={type} onChange={(e) => setType(e.target.value as ContractType)}>
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONTRACT_LABEL[t]} — {CONTRACT_HINT[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>С</span>
            <input name="contractFrom" type="date" className={`${inputCls} w-full`} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>По (пусто — бессрочно)</span>
            <input name="contractTo" type="date" className={`${inputCls} w-full`} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          {type === 'hpp' && (
            <label className="block">
              <span className={labelCls}>Испытательный срок до</span>
              <input name="contractProbation" type="date" className={`${inputCls} w-full`} value={probation} min={from} onChange={(e) => setProbation(e.target.value)} />
            </label>
          )}
          {type === 'ico' && (
            <label className="block">
              <span className={labelCls}>IČO</span>
              <input name="contractIco" inputMode="numeric" maxLength={10} className={`${inputCls} w-full`} value={ico} onChange={(e) => setIco(e.target.value)} />
            </label>
          )}
          <label className="block sm:col-span-3">
            <span className={labelCls}>Заметка</span>
            <input name="contractNote" className={`${inputCls} w-full`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      )}
      <ErrorLine text={error} />
      <div className="mt-4 flex gap-2 flex-wrap">
        <button type="button" className={btnPinkCls} onClick={save} disabled={!valid || saving}>
          {saving ? 'Сохраняю…' : close ? 'Закрыть договор' : 'Сохранить'}
        </button>
        <button type="button" className={btnNeutralCls} onClick={onCancel} disabled={saving}>
          Отмена
        </button>
      </div>
    </div>
  )
}
