import { useEffect, useRef, useState } from 'react'
import { badgeFaintCls, badgeMutedCls, btnNeutralCls, btnPinkCls, hintCls, inputCls, labelCls } from '../../../../../ui/kit'
import {
  POSITION_LABEL,
  createChecklistItem,
  fetchChecklistCatalog,
  fmtWhen,
  setStaffOnboarding,
  updateChecklistItem,
  type ChecklistCatalogItem,
  type ChecklistItem,
  type Position,
  type StaffCard,
} from '../../fetch/staff'
import { ErrorLine, SectionCard } from './ui'

const POSITIONS = Object.keys(POSITION_LABEL) as Position[]

/** Автопункт → секция карточки (data-testid), куда вести по ссылке. */
const SECTION_TEST_ID: Record<NonNullable<ChecklistItem['section']>, string> = {
  account: 'staff-account',
  private: 'staff-private',
  header: 'staff-header',
  documents: 'staff-private',
  contract: 'staff-contract',
  pay: 'staff-pay',
  booking: 'staff-booking',
}

const goTo = (section: ChecklistItem['section']) => {
  if (!section) return
  document.querySelector(`[data-testid="${SECTION_TEST_ID[section]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// «Онбординг» (фаза 2): автопункты закрываются сами по данным карточки (сервер —
// источник истины), свои пункты руководства — галочкой с «кто и когда». Процент — по тем
// же пунктам. Ушедшим чек-лист не ведётся.
export function OnboardingSection({ card, onCard, onReload }: { card: StaffCard; onCard: (c: StaffCard) => void; onReload: () => void }) {
  const list = card.checklist
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [setup, setSetup] = useState(false)

  if (!list) return null

  const toggle = async (item: ChecklistItem) => {
    if (!item.itemId || busy) return
    setBusy(item.itemId)
    setError(null)
    try {
      onCard(await setStaffOnboarding(card.documentId, item.itemId, !item.done))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const auto = list.items.filter((i) => i.auto)
  const own = list.items.filter((i) => !i.auto)

  return (
    <SectionCard
      title={`Онбординг · ${list.percent} %`}
      testId="staff-onboarding"
      action={
        !setup && (
          <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={() => setSetup(true)}>
            Настроить пункты
          </button>
        )
      }
    >
      <div
        className="h-2 rounded-full bg-line-soft overflow-hidden"
        role="progressbar"
        aria-valuenow={list.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Заполненность карточки"
      >
        <div className={`h-full ${list.percent === 100 ? 'bg-pos' : 'bg-brand'}`} style={{ width: `${list.percent}%` }} />
      </div>
      <div className={`mt-1.5 ${hintCls}`}>
        {list.open === 0 ? 'Всё готово.' : `Осталось пунктов: ${list.open}.`} Автоматические пункты закрываются сами, когда заполнены данные.
      </div>

      <div className={`${labelCls} mt-4`}>По данным карточки</div>
      <ul className="m-0 p-0 list-none" data-testid="staff-onboarding-auto">
        {auto.map((i) => (
          <li key={i.key} data-item={i.key} className="flex items-center gap-2 py-1.5">
            <Mark done={i.done} />
            <span className={`text-[13.5px] font-semibold ${i.done ? 'text-ink-soft' : 'text-ink'}`}>{i.title}</span>
            {!i.done && i.section && (
              <button type="button" className="text-[12.5px] font-semibold text-brand-dark underline" onClick={() => goTo(i.section)}>
                заполнить
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className={`${labelCls} mt-4`}>Свои пункты</div>
      {own.length === 0 ? (
        <div className="text-[13px] font-semibold text-ink-faint">Своих пунктов для этой должности нет.</div>
      ) : (
        <ul className="m-0 p-0 list-none" data-testid="staff-onboarding-own">
          {own.map((i) => (
            <li key={i.itemId} data-item={i.itemId} className="flex items-center gap-2 py-1.5 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={i.done}
                  disabled={busy !== null || card.left}
                  onChange={() => toggle(i)}
                  aria-label={i.title}
                />
                <span className={`text-[13.5px] font-semibold ${i.done ? 'text-ink-soft' : 'text-ink'}`}>{i.title}</span>
              </label>
              {i.done && (
                <span className={hintCls}>
                  {i.doneBy || '—'} · {fmtWhen(i.doneAt ?? null)}
                </span>
              )}
              {i.active === false && <span className={badgeFaintCls}>пункт выключен</span>}
            </li>
          ))}
        </ul>
      )}
      <ErrorLine text={error} />

      {setup && <CatalogEditor onClose={() => setSetup(false)} onChanged={onReload} />}
    </SectionCard>
  )
}

function Mark({ done }: { done: boolean }) {
  return (
    <span
      aria-label={done ? 'готово' : 'не готово'}
      className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[11px] font-extrabold shrink-0 ${
        done ? 'bg-pos text-white' : 'border border-line text-ink-faint'
      }`}
    >
      {done ? '✓' : ''}
    </span>
  )
}

// «Настроить пункты»: каталог своих пунктов — общий для всех карточек. Удаления нет:
// выключенный пункт уходит из новых чек-листов, поставленные отметки остаются.
function CatalogEditor({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<ChecklistCatalogItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [positions, setPositions] = useState<Position[]>([...POSITIONS])
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    fetchChecklistCatalog()
      .then((r) => alive.current && setItems(r.items))
      .catch((e) => alive.current && setError((e as Error).message))
    return () => {
      alive.current = false
    }
  }, [])

  const run = async (fn: () => Promise<{ items: ChecklistCatalogItem[] }>) => {
    if (busy) return false
    setBusy(true)
    setError(null)
    try {
      const r = await fn()
      if (alive.current) setItems(r.items)
      // карточку перечитает страница: состав пунктов поменялся
      onChanged()
      return true
    } catch (e) {
      if (alive.current) setError((e as Error).message)
      return false
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const add = async () => {
    const t = title.replace(/\s+/g, ' ').trim()
    if (!t || !positions.length) return
    if (await run(() => createChecklistItem(t, positions))) setTitle('')
  }

  return (
    <div className="mt-4 rounded-xl border border-line px-4 py-3.5" data-testid="staff-checklist-catalog">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[13.5px] font-extrabold text-ink">Свои пункты — для всех сотрудников</span>
        <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={onClose}>
          Готово
        </button>
      </div>
      {!items ? (
        <div className="mt-2 text-[13px] font-semibold text-ink-faint">{error ? '' : 'Načítání…'}</div>
      ) : (
        <ul className="m-0 mt-2 p-0 list-none">
          {items.map((i) => (
            <CatalogRow key={i.documentId} item={i} busy={busy} run={run} />
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-end gap-2 flex-wrap">
        <label className="block flex-1 min-w-[200px]">
          <span className={labelCls}>Новый пункт</span>
          <input
            name="checklistTitle"
            className={`${inputCls} w-full`}
            value={title}
            maxLength={80}
            placeholder="Например: выдан пропуск"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <PositionsPicker value={positions} onChange={setPositions} />
        <button type="button" className={btnPinkCls} onClick={add} disabled={busy || !title.trim() || !positions.length}>
          Добавить
        </button>
      </div>
      <div className={`mt-2 ${hintCls}`}>Удаления нет: выключенный пункт уходит из новых чек-листов, поставленные отметки остаются.</div>
      <ErrorLine text={error} />
    </div>
  )
}

function CatalogRow({
  item,
  busy,
  run,
}: {
  item: ChecklistCatalogItem
  busy: boolean
  run: (fn: () => Promise<{ items: ChecklistCatalogItem[] }>) => Promise<boolean>
}) {
  const [edit, setEdit] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [positions, setPositions] = useState<Position[]>(item.positions)

  const save = async () => {
    const t = title.replace(/\s+/g, ' ').trim()
    const data: Parameters<typeof updateChecklistItem>[1] = {}
    if (t && t !== item.title) data.title = t
    if (positions.length && positions.join() !== item.positions.join()) data.positions = positions
    if (!Object.keys(data).length) return setEdit(false)
    if (await run(() => updateChecklistItem(item.documentId, data))) setEdit(false)
  }

  return (
    <li className="py-2 border-t border-line-soft first:border-t-0" data-catalog={item.documentId}>
      {!edit ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[13.5px] font-semibold ${item.active ? 'text-ink' : 'text-ink-faint line-through'}`}>{item.title}</span>
          <span className={badgeMutedCls}>{item.positions.map((p) => POSITION_LABEL[p]).join(', ')}</span>
          <span className="flex-1" />
          <button type="button" className={`${btnNeutralCls} !px-2.5 !py-1`} disabled={busy} onClick={() => setEdit(true)}>
            Изменить
          </button>
          <button
            type="button"
            className={`${btnNeutralCls} !px-2.5 !py-1`}
            disabled={busy}
            onClick={() => run(() => updateChecklistItem(item.documentId, { active: !item.active }))}
          >
            {item.active ? 'Выключить' : 'Включить'}
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2 flex-wrap">
          <input
            aria-label="Название пункта"
            className={`${inputCls} flex-1 min-w-[200px]`}
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
          <PositionsPicker value={positions} onChange={setPositions} />
          <button type="button" className={btnPinkCls} disabled={busy || !title.trim() || !positions.length} onClick={save}>
            Сохранить
          </button>
          <button type="button" className={btnNeutralCls} disabled={busy} onClick={() => setEdit(false)}>
            Отмена
          </button>
        </div>
      )}
    </li>
  )
}

function PositionsPicker({ value, onChange }: { value: Position[]; onChange: (v: Position[]) => void }) {
  return (
    <fieldset className="flex items-center gap-3 flex-wrap py-2">
      <legend className="sr-only">Кому пункт</legend>
      {POSITIONS.map((p) => (
        <label key={p} className="flex items-center gap-1.5 cursor-pointer text-[13px] font-semibold text-ink-body">
          <input
            type="checkbox"
            checked={value.includes(p)}
            onChange={(e) => onChange(e.target.checked ? POSITIONS.filter((x) => x === p || value.includes(x)) : value.filter((x) => x !== p))}
          />
          {POSITION_LABEL[p]}
        </label>
      ))}
    </fieldset>
  )
}
