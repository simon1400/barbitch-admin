// Карточка «Korekce po návštěvě» в шторке брони (s210): явный признак бесплатной
// коррекции + выбор визита клиента, с которого переносится доля мастера.
//
// Признак ставится руками, а не по названию услуги: коррекцией бывает и обычная
// бронь за 0 Kč, а 0 Kč бывает бонусом (решение владельца s209 п. 5). У «Korekce do
// 5 dnů» сервер ставит его сам при создании брони и подставляет визит.
// Пока визит не закрыт — правка свободна; у закрытого сервер отвечает 409
// korekce_locked (перенос уже посчитан) — карточка тогда только показывает.

import { useEffect, useState } from 'react'
import type { CalendarBooking } from '../fetch/calendarDay'
import { enginePatchBooking, fetchKorekceCandidates, type KorekceCandidate } from '../fetch/engineApi'
import { candidateLabel, csDay } from './korekce'

export type KorekceChange = { korekce: boolean; korekceOf: CalendarBooking['korekceOf'] }

export const KorekceCard = ({
  b,
  busy,
  onChanged,
}: {
  b: CalendarBooking
  busy: boolean
  onChanged: (next: KorekceChange) => void
}) => {
  const [on, setOn] = useState(b.korekce === true)
  const [target, setTarget] = useState(b.korekceOf?.documentId || '')
  const [items, setItems] = useState<KorekceCandidate[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = b.status === 'checkedOut'

  useEffect(() => {
    if (!on || items || locked) return
    let cancelled = false
    fetchKorekceCandidates(b.documentId)
      .then((res) => !cancelled && setItems(res.items || []))
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [on, items, locked, b.documentId])

  const save = async (nextOn: boolean, nextTarget: string) => {
    setSaving(true)
    setError(null)
    try {
      const res = await enginePatchBooking(b.documentId, { korekce: nextOn, korekceOf: nextOn ? nextTarget || null : null })
      setOn(res.korekce === true)
      setTarget(res.korekceOf?.documentId || '')
      onChanged({ korekce: res.korekce === true, korekceOf: res.korekceOf ?? null })
    } catch (e) {
      setOn(b.korekce === true)
      setTarget(b.korekceOf?.documentId || '')
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // текущий визит мог выпасть из окна 14 дней — всё равно показываем его в селекте
  const options = [...(items || [])]
  if (b.korekceOf?.documentId && !options.some((c) => c.documentId === b.korekceOf!.documentId)) {
    options.unshift({
      documentId: b.korekceOf.documentId,
      date: b.korekceOf.date || '',
      startsAt: b.korekceOf.startsAt || null,
      status: b.korekceOf.status || '',
      master: b.korekceOf.employeeNameRaw || '',
      services: (b.korekceOf.services || []).map((s) => s.title).join(' + '),
      totalPrice: b.korekceOf.totalPrice == null ? null : Number(b.korekceOf.totalPrice),
      hasRecord: true,
    })
  }
  const disabled = busy || saving || locked

  return (
    <div className="mt-3 rounded-xl border border-gray-400 p-3 dark:border-[#2e2e2c]" data-korekce-card>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Korekce po návštěvě
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={on}
          disabled={disabled}
          onChange={(e) => {
            setOn(e.target.checked)
            save(e.target.checked, target)
          }}
          className="accent-primary"
          data-korekce-toggle
        />
        Bezplatná korekce — převést podíl z původní návštěvy
      </label>
      {on && (
        <select
          value={target}
          disabled={disabled}
          onChange={(e) => {
            setTarget(e.target.value)
            save(true, e.target.value)
          }}
          className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary focus:outline-none dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:text-gray-300 dark:[color-scheme:dark]"
          data-korekce-select
        >
          <option value="">{items || locked ? '— vyberte návštěvu —' : 'Načítám…'}</option>
          {options.map((c) => (
            <option key={c.documentId} value={c.documentId}>
              {candidateLabel(c)}
            </option>
          ))}
        </select>
      )}
      {on && !target && !locked && items && (
        <p className="mt-1.5 text-[12px] font-normal leading-snug text-amber-700 dark:text-amber-300">
          {items.length
            ? 'Bez původní návštěvy nelze korekci uzavřít.'
            : 'Klientka nemá v posledních 14 dnech jinou návštěvu.'}
        </p>
      )}
      {locked && (
        <p className="mt-1.5 text-[12px] font-normal leading-snug text-gray-500 dark:text-gray-400">
          {on && b.korekceOf?.date ? `Po návštěvě ${csDay(b.korekceOf.date)}. ` : ''}Návštěva je uzavřená — pro změnu
          nejdřív zrušte uzavření.
        </p>
      )}
      {error && (
        <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-[12px] font-normal leading-snug text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}
