import { useState } from 'react'
import { btnNeutralCls, btnPinkCls, hintCls, inputCls, labelCls } from '../../../../../ui/kit'
import { fmtCsDate, todayYmd } from '../../../../../utils/date'
import { worksAsMaster } from '../../../../../lib/worksAsMaster'
import {
  POSITION_LABEL,
  bookingsOf,
  cleanName,
  patchStaff,
  positionLabel,
  renameStaff,
  type BookingRef,
  type Position,
  type StaffCard,
  type Tier,
} from '../../fetch/staff'
import { ConflictList } from '../timeoff/ConflictList'
import { EditButton, ErrorLine, Field, OkLine, SectionCard } from './ui'

const POSITIONS = Object.keys(POSITION_LABEL) as Position[]

/** Почему имя из карточки не меняется (null — можно). */
const renameBlocker = (card: StaffCard): string | null => {
  if (card.left) return 'Сотрудник завершил работу — имя не меняется.'
  if (card.self) return 'Себя переименовать нельзя — сменится ваш логин.'
  if (card.account?.role === 'owner') return 'Учётка владельца из карточки не меняется.'
  return null
}

// Секция «Основное»: должность, уровень, дата приёма; имя — отдельным действием.
export function BasicSection({ card, onCard }: { card: StaffCard; onCard: (c: StaffCard) => void }) {
  const [edit, setEdit] = useState(false)
  const [position, setPosition] = useState<Position | ''>(card.position ?? '')
  const [alsoMaster, setAlsoMaster] = useState(card.alsoMaster)
  const [tier, setTier] = useState<Tier>(card.tier)
  const [hiredAt, setHiredAt] = useState(card.hiredAt ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<BookingRef[]>([])
  const [ok, setOk] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)

  const positionLocked = card.self || card.account?.role === 'owner'
  const startEdit = () => {
    setPosition(card.position ?? '')
    setAlsoMaster(card.alsoMaster)
    setTier(card.tier)
    setHiredAt(card.hiredAt ?? '')
    setError(null)
    setBookings([])
    setOk(null)
    setEdit(true)
  }

  const posChanged = !!position && position !== card.position
  // «Принимает клиенток» (s249) — только у управляющей; смену должности сервер снимет сам
  const isManagerNext = (position || card.position) === 'manager'
  const alsoMasterNext = isManagerNext && alsoMaster
  const wasMaster = worksAsMaster(card)
  const willMaster = worksAsMaster({ position: position || card.position, alsoMaster: alsoMasterNext })
  const masterChanged = wasMaster !== willMaster
  const data: Record<string, unknown> = {}
  if (posChanged) data.position = position
  if (isManagerNext && alsoMasterNext !== card.alsoMaster) data.alsoMaster = alsoMasterNext
  if (willMaster && tier !== card.tier) data.tier = tier
  if ((hiredAt || null) !== (card.hiredAt || null)) data.hiredAt = hiredAt || null
  const dirty = Object.keys(data).length > 0

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    setBookings([])
    try {
      const res = await patchStaff(card.documentId, 'basic', data, card.updatedAt)
      onCard(res)
      setEdit(false)
      setOk(posChanged && res.account ? 'Сохранено. Роль входа сменилась — сотруднику нужно войти заново.' : 'Сохранено.')
    } catch (e) {
      setError((e as Error).message)
      setBookings(bookingsOf(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title="Основное"
      testId="staff-basic"
      action={!edit && !card.left && <EditButton onClick={startEdit} />}
    >
      {!edit ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Field label="Должность">{positionLabel(card.position)}</Field>
            {card.position === 'manager' && (
              <Field label="Принимает клиенток">{card.alsoMaster ? 'да — как мастер' : 'нет'}</Field>
            )}
            {wasMaster && <Field label="Уровень">{card.tier === 'junior' ? 'junior (−20 %)' : 'senior'}</Field>}
            <Field label="Работает с">{fmtCsDate(card.hiredAt)}</Field>
            <Field label="Статус">
              {card.left ? `Завершил(а) работу${card.leftAt ? ` ${fmtCsDate(card.leftAt)}` : ''}` : 'Работает'}
            </Field>
          </div>
          <OkLine text={ok} />
          <RenameBlock card={card} onCard={onCard} open={renaming} setOpen={setRenaming} />
          {card.left && <LeftAtBlock card={card} onCard={onCard} />}
        </>
      ) : (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <label className="block">
              <span className={labelCls}>Должность</span>
              <select
                name="position"
                className={`${inputCls} w-full`}
                value={position}
                disabled={positionLocked}
                onChange={(e) => setPosition(e.target.value as Position)}
              >
                {!card.position && <option value="">— выберите —</option>}
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {POSITION_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            {isManagerNext && (
              <label className="flex items-center gap-2 self-end pb-2.5 text-[13.5px] font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  name="alsoMaster"
                  checked={alsoMaster}
                  onChange={(e) => setAlsoMaster(e.target.checked)}
                  data-testid="staff-also-master"
                />
                Принимает клиенток как мастер
              </label>
            )}
            {willMaster && (
              <label className="block">
                <span className={labelCls}>Уровень</span>
                <select name="tier" className={`${inputCls} w-full`} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
                  <option value="senior">senior</option>
                  <option value="junior">junior (−20 % на сайте)</option>
                </select>
              </label>
            )}
            <label className="block">
              <span className={labelCls}>Работает с</span>
              <input
                name="hiredAt"
                type="date"
                className={`${inputCls} w-full`}
                value={hiredAt}
                onChange={(e) => setHiredAt(e.target.value)}
              />
            </label>
          </div>
          {positionLocked && (
            <div className={`mt-2 ${hintCls}`}>
              {card.self ? 'Свою должность менять нельзя — вместе с ней сменится ваша роль входа.' : 'Учётка владельца из карточки не меняется.'}
            </div>
          )}
          {(posChanged || masterChanged) && (
            <div className="mt-2 text-[12.5px] font-semibold text-warn" data-testid="staff-position-warning">
              {wasMaster && !willMaster
                ? 'Мастер пропадёт из календаря и с сайта. Будущие брони сначала нужно перенести. '
                : ''}
              {!wasMaster && willMaster
                ? 'Появится колонка в календаре; на сайте — после назначения услуг в Каталоге. Долю от услуг задайте в «Оплате». '
                : ''}
              {posChanged && card.account ? 'Роль входа сменится вместе с должностью — сотруднику нужно будет войти заново.' : ''}
            </div>
          )}
          <ConflictList rows={bookings} title={`Будущие брони мастера (${bookings.length}) — перенесите их на других мастеров:`} />
          <ErrorLine text={error} />
          <div className="mt-4 flex gap-2">
            <button type="button" className={btnPinkCls} onClick={save} disabled={!dirty || saving}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button type="button" className={btnNeutralCls} onClick={() => setEdit(false)} disabled={saving}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// Переименование: имя карточки + логин учётки одним действием на сервере.
function RenameBlock({
  card,
  onCard,
  open,
  setOpen,
}: {
  card: StaffCard
  onCard: (c: StaffCard) => void
  open: boolean
  setOpen: (v: boolean) => void
}) {
  const [name, setName] = useState(card.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const blocker = renameBlocker(card)
  const next = cleanName(name)
  const canSave = !saving && next.length >= 2 && next !== card.name

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const res = await renameStaff(card.documentId, next, card.updatedAt)
      onCard(res)
      setOpen(false)
      setOk(res.accountRenamed ? `Переименовано. Логин теперь «${res.name}» — сотруднику нужно войти заново.` : 'Переименовано.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (card.left) return null
  if (!open) {
    return (
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className={`${btnNeutralCls} !px-3 !py-1.5`}
          disabled={!!blocker}
          title={blocker ?? undefined}
          onClick={() => {
            setName(card.name)
            setError(null)
            setOk(null)
            setOpen(true)
          }}
        >
          Переименовать
        </button>
        {blocker && <span className={hintCls}>{blocker}</span>}
        <OkLine text={ok} />
      </div>
    )
  }
  return (
    <div className="mt-4 rounded-lg border border-line px-4 py-3" data-testid="staff-rename">
      <label className="block max-w-[420px]">
        <span className={labelCls}>Новое имя</span>
        <input name="rename" className={`${inputCls} w-full`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className={`mt-2 ${hintCls}`}>
        {card.account ? 'Логин входа сменится на новое имя — сотруднику нужно будет войти заново. ' : ''}
        Прошлые месяцы зарплат в кэше покажут старое имя до «Обновить». Подписи в старых бронях не меняются.
      </div>
      <ErrorLine text={error} />
      <div className="mt-3 flex gap-2">
        <button type="button" className={btnPinkCls} onClick={save} disabled={!canSave}>
          {saving ? 'Сохраняю…' : 'Переименовать'}
        </button>
        <button type="button" className={btnNeutralCls} onClick={() => setOpen(false)} disabled={saving}>
          Отмена
        </button>
      </div>
    </div>
  )
}

// Дата ухода у уже ушедших (s227): ушедшие до модуля карточки её не имеют, а без неё
// не считается срок стирания личных данных (3 года). Работающим — «Завершить работу».
function LeftAtBlock({ card, onCard }: { card: StaffCard; onCard: (c: StaffCard) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(card.leftAt ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const today = todayYmd()
  const canSave = !saving && !!value && value !== card.leftAt && value <= today && (!card.hiredAt || value >= card.hiredAt)

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const res = await patchStaff(card.documentId, 'basic', { leftAt: value }, card.updatedAt)
      onCard(res)
      setOpen(false)
      setOk('Дата ухода сохранена.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div className="mt-4 flex items-center gap-3 flex-wrap" data-testid="staff-leftat">
        {!card.leftAt && (
          <span className="text-[12.5px] font-semibold text-warn">
            Дата ухода не указана — без неё не сработает напоминание о стирании личных данных через 3 года.
          </span>
        )}
        <button
          type="button"
          className={`${btnNeutralCls} !px-3 !py-1.5`}
          onClick={() => {
            setValue(card.leftAt ?? '')
            setError(null)
            setOk(null)
            setOpen(true)
          }}
        >
          {card.leftAt ? 'Изменить дату ухода' : 'Указать дату ухода'}
        </button>
        <OkLine text={ok} />
      </div>
    )
  }
  return (
    <div className="mt-4 rounded-lg border border-line px-4 py-3" data-testid="staff-leftat">
      <label className="block max-w-[240px]">
        <span className={labelCls}>Дата ухода</span>
        <input
          name="leftAt"
          type="date"
          className={`${inputCls} w-full`}
          value={value}
          min={card.hiredAt ?? undefined}
          max={today}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className={`mt-2 ${hintCls}`}>Подсказка: дата последней услуги или смены. Ставки и учётка этим не меняются.</div>
      <ErrorLine text={error} />
      <div className="mt-3 flex gap-2">
        <button type="button" className={btnPinkCls} onClick={save} disabled={!canSave}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <button type="button" className={btnNeutralCls} onClick={() => setOpen(false)} disabled={saving}>
          Отмена
        </button>
      </div>
    </div>
  )
}
