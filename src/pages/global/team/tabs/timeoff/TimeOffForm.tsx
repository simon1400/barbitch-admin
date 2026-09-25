import { useEffect, useState } from 'react'
import type { InternalRecipient } from '../../../../../lib/personals'
import { btnNeutralCls, btnPinkCls, cardTitleCls, formCardCls, hintCls, inputCls, labelCls } from '../../../../../ui/kit'
import {
  MAX_SPAN_DAYS,
  TYPE_LABELS,
  createTimeOff,
  fetchTimeOffConflicts,
  spanDays,
  updateTimeOff,
  type TimeOffConflict,
  type TimeOffRecord,
  type TimeOffSaveResult,
  type TimeOffType,
} from '../../fetch/timeOff'
import { ConflictList } from './ConflictList'

const POSITION_LABEL: Record<string, string> = {
  master: 'мастер',
  administrator: 'администратор',
  manager: 'управляющая',
}

const TYPE_ORDER: TimeOffType[] = ['vacation', 'sick', 'personal']
const YMD = /^\d{4}-\d{2}-\d{2}$/

// Форма отпуска / больничного: новая запись или правка существующей (`editing`).
// Сервер перепроверяет всё то же самое — здесь только чтобы кнопка не отправляла
// заведомо неверное. Пока форма заполнена, показывает брони мастера на эти дни.
export function TimeOffForm({
  staff,
  editing,
  defaultDate,
  onSaved,
  onCancel,
}: {
  staff: InternalRecipient[]
  editing: TimeOffRecord | null
  defaultDate: string
  onSaved: (res: TimeOffSaveResult, wasEdit: boolean) => void
  onCancel?: () => void
}) {
  const [personal, setPersonal] = useState(editing?.personal?.documentId ?? '')
  const [type, setType] = useState<TimeOffType>(editing?.type ?? 'vacation')
  const [startDate, setStartDate] = useState(editing?.startDate ?? defaultDate)
  const [endDate, setEndDate] = useState(editing?.endDate ?? defaultDate)
  const [paid, setPaid] = useState(editing?.paid ?? true)
  const [comment, setComment] = useState(editing?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<{ key: string; rows: TimeOffConflict[] } | null>(null)

  const datesOk = YMD.test(startDate) && YMD.test(endDate) && endDate >= startDate
  const days = datesOk ? spanDays(startDate, endDate) : 0
  const tooLong = days > MAX_SPAN_DAYS
  const person = staff.find((p) => p.docId === personal)
  // ушедший сотрудник в правке старой записи — в списке активных его нет
  const personName = person?.name ?? (editing?.personal?.documentId === personal ? editing?.personal?.name : '')
  const isMaster = person?.position === 'master'
  const canSave = !saving && !!personal && datesOk && !tooLong

  // брони мастера на эти дни — блок их не отменит
  const conflictKey = personal && datesOk && !tooLong ? `${personal}|${startDate}|${endDate}` : ''
  useEffect(() => {
    if (!conflictKey) return
    let alive = true
    const [p, s, e] = conflictKey.split('|')
    fetchTimeOffConflicts(p, s, e)
      .then((rows) => alive && setConflicts({ key: conflictKey, rows }))
      .catch(() => alive && setConflicts({ key: conflictKey, rows: [] }))
    return () => {
      alive = false
    }
  }, [conflictKey])
  const shownConflicts = conflicts && conflicts.key === conflictKey ? conflicts.rows : []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    const input = { personal, type, startDate, endDate, paid, comment: comment.trim() }
    try {
      const res = editing ? await updateTimeOff(editing.documentId, input) : await createTimeOff(input)
      if (!editing) {
        // тип и сотрудник остаются — удобно завести ещё одну запись
        setComment('')
      }
      onSaved(res, !!editing)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${formCardCls} mb-3.5`} data-testid="timeoff-form">
      <h2 className={`${cardTitleCls} mb-4`}>
        {editing ? `Изменить запись — ${editing.personal?.name ?? ''}` : 'Новый отпуск / больничный'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block">
          <span className={labelCls}>Сотрудник</span>
          <select
            name="personal"
            className={`${inputCls} w-full`}
            value={personal}
            onChange={(e) => setPersonal(e.target.value)}
          >
            <option value="">— выберите —</option>
            {editing?.personal && !person && (
              <option value={editing.personal.documentId}>{editing.personal.name}</option>
            )}
            {staff.map((p) => (
              <option key={p.docId} value={p.docId}>
                {p.name}
                {p.position && POSITION_LABEL[p.position] ? ` · ${POSITION_LABEL[p.position]}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Тип</span>
          <select
            name="type"
            className={`${inputCls} w-full`}
            value={type}
            onChange={(e) => setType(e.target.value as TimeOffType)}
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>С</span>
          <input
            name="startDate"
            type="date"
            className={`${inputCls} w-full`}
            value={startDate}
            onChange={(e) => {
              const v = e.target.value
              setStartDate(v)
              // конец раньше нового начала — подтянуть, чтобы не править два поля
              if (YMD.test(v) && (!YMD.test(endDate) || endDate < v)) setEndDate(v)
            }}
          />
        </label>
        <label className="block">
          <span className={labelCls}>По (включительно)</span>
          <input
            name="endDate"
            type="date"
            className={`${inputCls} w-full`}
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2 cursor-pointer">
          <input name="paid" type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          <span className="text-[13px] font-semibold text-ink-body">Оплачивается</span>
        </label>
        <label className="block sm:col-span-2">
          <span className={labelCls}>Комментарий (необязательно)</span>
          <input
            name="comment"
            className={`${inputCls} w-full`}
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
      </div>

      {datesOk && !tooLong && (
        <div className="mt-2 text-[12px] font-normal text-ink-soft" data-testid="timeoff-days">
          {days} дн.
          {personal &&
            (isMaster
              ? ` · ${personName}: в календаре встанет блок на каждый день (на часы работы салона), онлайн-запись на эти дни закроется.`
              : ` · ${personName || 'сотрудник'} не мастер — в календаре ничего не меняется.`)}
        </div>
      )}
      {datesOk && tooLong && (
        <div className="mt-2 text-[12px] font-normal text-neg">Одна запись — не больше {MAX_SPAN_DAYS} дней.</div>
      )}
      {!datesOk && startDate && endDate && (
        <div className="mt-2 text-[12px] font-normal text-neg">Конец раньше начала.</div>
      )}

      <ConflictList
        rows={shownConflicts}
        title={`Брони на эти дни (${shownConflicts.length}) — блок их не отменит, перенесите или отмените в календаре:`}
      />

      {error && (
        <div role="alert" className="mt-3 text-[12px] font-semibold text-neg">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button type="submit" className={btnPinkCls} disabled={!canSave}>
          {saving ? 'Сохраняю…' : editing ? 'Сохранить' : 'Добавить'}
        </button>
        {onCancel && (
          <button type="button" className={btnNeutralCls} onClick={onCancel} disabled={saving}>
            Отмена
          </button>
        )}
        <span className={hintCls}>
          Дни считаются календарные, включая выходные. Удаление записи убирает и её блоки.
        </span>
      </div>
    </form>
  )
}
