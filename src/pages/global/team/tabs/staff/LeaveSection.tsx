import { useState } from 'react'
import { btnDangerCls, btnNeutralCls, hintCls, inputCls, labelCls } from '../../../../../ui/kit'
import { fmtCsDate } from '../../../../../utils/date'
import {
  bookingsOf,
  eraseStaff,
  fetchLeavePreview,
  leaveStaff,
  rateText,
  type BookingRef,
  type LeavePreview,
  type StaffCard,
} from '../../fetch/staff'
import { ConflictList } from '../timeoff/ConflictList'
import { ErrorLine, OkLine, SectionCard } from './ui'

const BLOCKER_TEXT: Record<string, string> = {
  staff_left: 'Сотрудник уже завершил работу.',
  self_leave: 'Себе завершить работу нельзя.',
  owner_account: 'Учётка владельца из карточки не меняется.',
  future_bookings: 'Есть будущие брони — сначала перенесите их на других мастеров.',
}

// «Завершить работу» (работающим) и «Стереть личные данные» (ушедшим через 3 года).
// Удаления карточки нет вовсе — на ней вся зарплатная история.
export function LeaveSection({ card, onCard }: { card: StaffCard; onCard: (c: StaffCard) => void }) {
  return card.left ? <EraseBlock card={card} onCard={onCard} /> : <LeaveBlock card={card} onCard={onCard} />
}

function LeaveBlock({ card, onCard }: { card: StaffCard; onCard: (c: StaffCard) => void }) {
  const [preview, setPreview] = useState<LeavePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [leftAt, setLeftAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<BookingRef[]>([])

  const openPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const p = await fetchLeavePreview(card.documentId)
      setPreview(p)
      setLeftAt(p.today)
      setBookings(p.bookings)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const blockers = preview ? preview.blockers : []
  const canLeave = !!preview && !blockers.length && !!leftAt && leftAt <= preview.today && !saving

  const submit = async () => {
    if (!preview || !canLeave) return
    if (!window.confirm(`Завершить работу «${card.name}» с ${fmtCsDate(leftAt)}? Вход в админку отключится, ставки закроются.`)) return
    setSaving(true)
    setError(null)
    try {
      const res = await leaveStaff(card.documentId, leftAt, card.updatedAt)
      onCard(res)
    } catch (e) {
      setError((e as Error).message)
      const rows = bookingsOf(e)
      if (rows.length) setBookings(rows)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Завершить работу" testId="staff-leave">
      {!preview ? (
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" className={btnDangerCls} onClick={openPreview} disabled={loading || card.self}>
            {loading ? 'Проверяю…' : 'Завершить работу…'}
          </button>
          <span className={hintCls}>
            {card.self
              ? 'Себе завершить работу нельзя.'
              : 'Сначала покажем, что изменится. Карточка и вся зарплатная история остаются.'}
          </span>
        </div>
      ) : (
        <div data-testid="staff-leave-preview">
          <ul className="m-0 pl-[18px] grid gap-1 text-[13px] font-medium text-ink-body">
            <li>Карточка станет неактивной; мастер пропадёт из календаря и с сайта.</li>
            <li>
              {preview.account
                ? preview.account.isActive
                  ? 'Вход в админку отключится — текущая сессия погаснет сразу.'
                  : 'Вход в админку уже отключён.'
                : 'Учётки нет.'}
            </li>
            <li>
              {preview.openRates.length
                ? `Закроются датой ухода: ${preview.openRates.map(rateText).join(', ')}.`
                : 'Открытых ставок нет.'}
            </li>
            <li>
              {preview.planBlocks
                ? `Снимутся будущие блоки плана графика: ${preview.planBlocks}.`
                : 'Будущих блоков плана графика нет.'}
            </li>
          </ul>
          <ConflictList rows={bookings} title={`Будущие брони (${bookings.length}) — перенесите их на других мастеров:`} />
          {blockers
            .filter((b) => b !== 'future_bookings')
            .map((b) => (
              <div key={b} className="mt-2 text-[12.5px] font-semibold text-neg">
                {BLOCKER_TEXT[b] ?? b}
              </div>
            ))}
          <label className="block mt-3 max-w-[220px]">
            <span className={labelCls}>Последний рабочий день</span>
            <input
              name="leftAt"
              type="date"
              className={`${inputCls} w-full`}
              value={leftAt}
              max={preview.today}
              min={preview.hiredAt ?? undefined}
              onChange={(e) => setLeftAt(e.target.value)}
            />
          </label>
          <div className={`mt-1 ${hintCls}`}>Не позже сегодняшнего дня — завершайте в последний день или позже.</div>
          <ErrorLine text={error} />
          <div className="mt-4 flex gap-2">
            <button type="button" className={btnDangerCls} onClick={submit} disabled={!canLeave}>
              {saving ? 'Сохраняю…' : 'Завершить работу'}
            </button>
            <button type="button" className={btnNeutralCls} onClick={() => setPreview(null)} disabled={saving}>
              Отмена
            </button>
            <button type="button" className={btnNeutralCls} onClick={openPreview} disabled={saving || loading}>
              Проверить снова
            </button>
          </div>
        </div>
      )}
      {!preview && <ErrorLine text={error} />}
    </SectionCard>
  )
}

function EraseBlock({ card, onCard }: { card: StaffCard; onCard: (c: StaffCard) => void }) {
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const e = card.erase

  const submit = async () => {
    if (saving || !confirmName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await eraseStaff(card.documentId, confirmName, card.updatedAt)
      onCard(res)
      setOpen(false)
      setOk(
        `Стёрто: личные данные, документов ${res.erased.documents}, заметок ${res.erased.notes}.`,
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Личные данные после ухода" testId="staff-erase">
      {e?.erasedAt ? (
        <div className="text-[13px] font-semibold text-ink-soft">Личные данные стёрты {fmtCsDate(e.erasedAt.slice(0, 10))}.</div>
      ) : !card.leftAt ? (
        <div className={hintCls}>Дата ухода не указана — срок стирания не считается. Укажите её в секции «Основное».</div>
      ) : !e?.due ? (
        <div className={hintCls}>
          Личные данные, сканы и заметки можно будет стереть с {fmtCsDate(e?.dueAt)} (через 3 года после ухода).
        </div>
      ) : !open ? (
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" className={btnDangerCls} onClick={() => setOpen(true)}>
            Стереть личные данные…
          </button>
          <span className={hintCls}>Прошло 3 года после ухода. Имя, должность, даты и зарплатная история останутся.</span>
        </div>
      ) : (
        <div>
          <div className="text-[13px] font-semibold text-ink-body">
            Будут стёрты без возможности восстановления: личные данные, банк и экстренный контакт, все сканы, заметки.
          </div>
          <label className="block mt-3 max-w-[360px]">
            <span className={labelCls}>Для подтверждения введите имя: {card.name}</span>
            <input name="confirmName" className={`${inputCls} w-full`} value={confirmName} onChange={(ev) => setConfirmName(ev.target.value)} />
          </label>
          <ErrorLine text={error} />
          <div className="mt-3 flex gap-2">
            <button type="button" className={btnDangerCls} onClick={submit} disabled={saving || !confirmName.trim()}>
              {saving ? 'Стираю…' : 'Стереть'}
            </button>
            <button type="button" className={btnNeutralCls} onClick={() => setOpen(false)} disabled={saving}>
              Отмена
            </button>
          </div>
        </div>
      )}
      <OkLine text={ok} />
    </SectionCard>
  )
}
