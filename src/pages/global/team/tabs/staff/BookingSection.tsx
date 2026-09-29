import { useState } from 'react'
import { Link } from 'react-router-dom'
import { badgeWarnCls, btnNeutralCls, btnPinkCls, hintCls, inputCls, labelCls } from '../../../../../ui/kit'
import { patchStaff, type StaffCard } from '../../fetch/staff'
import { EditButton, ErrorLine, Field, SectionCard } from './ui'

const linkCls = 'font-semibold text-brand-dark underline'

// Секция «Запись и календарь» (только мастер): услуги — в Каталоге, порядок колонки —
// «Pořadí» календаря, график — модуль «График мастеров»; здесь правится приоритет.
export function BookingSection({ card, onCard }: { card: StaffCard; onCard: (c: StaffCard) => void }) {
  const b = card.booking
  const [edit, setEdit] = useState(false)
  const [priority, setPriority] = useState(String(b.bookingPriority))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = /^-?\d+$/.test(priority.trim())
  const dirty = valid && Number(priority) !== b.bookingPriority

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    try {
      onCard(await patchStaff(card.documentId, 'booking', { bookingPriority: Number(priority) }, card.updatedAt))
      setEdit(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title="Запись и календарь"
      testId="staff-booking"
      action={
        !edit &&
        !card.left && (
          <EditButton
            label="Изменить приоритет"
            onClick={() => {
              setPriority(String(b.bookingPriority))
              setError(null)
              setEdit(true)
            }}
          />
        )
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Услуги">
          {b.servicesCount ? `${b.servicesCount} ` : ''}
          {!b.servicesCount && <span className={badgeWarnCls}>нет услуг — на сайте не появится</span>}{' '}
          <Link to="/global/catalog" className={linkCls}>
            назначить в Каталоге
          </Link>
        </Field>
        <Field label="График">
          {b.hasSchedule ? 'шаблон недели есть' : <span className={badgeWarnCls}>нет шаблона — открыт весь день</span>}{' '}
          <Link to={`/schedule?master=${encodeURIComponent(card.documentId)}`} className={linkCls}>
            открыть график
          </Link>
        </Field>
        {!edit ? (
          <Field label="Приоритет «Kdokoliv»">{b.bookingPriority}</Field>
        ) : (
          <label className="block">
            <span className={labelCls}>Приоритет «Kdokoliv»</span>
            <input
              name="bookingPriority"
              type="number"
              className={`${inputCls} w-[120px]`}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
            <div className={`mt-1 ${hintCls}`}>Выше число — мастер чаще получает брони «к любому мастеру». 0 — поровну.</div>
          </label>
        )}
        <Field label="Колонка в календаре">
          {b.noonaEmployeeId ? (
            <>
              место {b.calendarOrder || '—'} <span className="text-[11px] font-mono text-ink-label">· {b.noonaEmployeeId}</span>
            </>
          ) : (
            <span className={badgeWarnCls}>нет ключа колонки — мастер не в календаре</span>
          )}
        </Field>
      </div>
      {edit && (
        <>
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
      {!edit && <div className={`mt-3 ${hintCls}`}>Порядок колонок меняется в календаре («Pořadí»).</div>}
    </SectionCard>
  )
}
