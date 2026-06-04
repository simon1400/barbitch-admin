import { useState } from 'react'
import type {
  DescriptionTarget,
  PriceTarget,
  RenameTarget,
  StrapiAddonGroup,
} from '../../fetch/manageServices'

interface Props {
  group: StrapiAddonGroup
  // Base service duration (minutes) — lives on the Noona event_type, not in the
  // addon-group, so it's passed in separately.
  baseDuration: number
  onPriceEdit: (target: PriceTarget, newValue: number) => void
  onDurationEdit: (target: PriceTarget, newValue: number) => void
  onRename: (target: RenameTarget, newName: string) => void
  onReorder: (kind: 'addon' | 'modifier', orderedIds: string[]) => void
  onSaveDescription: (target: DescriptionTarget, description: string) => void
  onDeleteAddon: (label: string) => void
  onDeleteModifier: (key: string) => void
  onDeleteService: () => void
  disabled?: boolean
}

const numOrNull = (s: string): number | null => {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : null
}

// Swap element at index i with its neighbour in direction dir (-1 up / +1 down)
const swap = (arr: string[], i: number, dir: -1 | 1): string[] => {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export const ServiceEditor = ({
  group,
  baseDuration,
  onPriceEdit,
  onDurationEdit,
  onRename,
  onReorder,
  onSaveDescription,
  onDeleteAddon,
  onDeleteModifier,
  onDeleteService,
  disabled,
}: Props) => {
  const [base, setBase] = useState(String(group.base_price))
  const [baseTitle, setBaseTitle] = useState(group.title)
  const [baseDur, setBaseDur] = useState(String(baseDuration))
  const [addonVals, setAddonVals] = useState<Record<string, string>>(
    Object.fromEntries(group.addons.map((a) => [a.label, String(a.price_diff)])),
  )
  const [modVals, setModVals] = useState<Record<string, string>>(
    Object.fromEntries(group.modifiers.map((m) => [m.key, String(m.price_diff)])),
  )
  // Duration diffs (minutes) — keyed by stable identifier like the price/name maps
  const [addonDurVals, setAddonDurVals] = useState<Record<string, string>>(
    Object.fromEntries(group.addons.map((a) => [a.label, String(a.duration_diff ?? 0)])),
  )
  const [modDurVals, setModDurVals] = useState<Record<string, string>>(
    Object.fromEntries(group.modifiers.map((m) => [m.key, String(m.duration_diff ?? 0)])),
  )
  // Rename inputs are keyed by the STABLE identifier (addon label / modifier key),
  // so editing the name never breaks the price/delete buttons that reference it.
  const [addonNames, setAddonNames] = useState<Record<string, string>>(
    Object.fromEntries(group.addons.map((a) => [a.label, a.label])),
  )
  const [modNames, setModNames] = useState<Record<string, string>>(
    Object.fromEntries(group.modifiers.map((m) => [m.key, m.label])),
  )
  // Client-facing info text (shown via "info" toggle on /book/[serviceId]/extras).
  // Keyed by the stable identifier (addon label / modifier key), like names above.
  const [addonDesc, setAddonDesc] = useState<Record<string, string>>(
    Object.fromEntries(group.addons.map((a) => [a.label, a.description ?? ''])),
  )
  const [modDesc, setModDesc] = useState<Record<string, string>>(
    Object.fromEntries(group.modifiers.map((m) => [m.key, m.description ?? ''])),
  )

  // Display order (drives the client booking page). Local until "Сохранить порядок".
  // Component is remounted with key={documentId:dataVersion} after each apply, so
  // these re-init from the freshly reloaded group.
  const origAddonOrder = group.addons.map((a) => a.label)
  const origModOrder = group.modifiers.map((m) => m.key)
  const [addonOrder, setAddonOrder] = useState<string[]>(origAddonOrder)
  const [modOrder, setModOrder] = useState<string[]>(origModOrder)
  const addonByLabel = new Map(group.addons.map((a) => [a.label, a]))
  const modByKey = new Map(group.modifiers.map((m) => [m.key, m]))
  const addonOrderChanged = addonOrder.join('|') !== origAddonOrder.join('|')
  const modOrderChanged = modOrder.join('|') !== origModOrder.join('|')

  const priceBtn =
    'px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50'
  const durBtn =
    'px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50'
  const renameBtn =
    'px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-50'
  const delBtn =
    'px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50'
  const arrowBtn =
    'w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
  const saveOrderBtn =
    'px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50'
  const input =
    'w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
  const nameInput =
    'flex-1 min-w-40 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
  const descInput =
    'flex-1 min-w-40 border border-gray-300 rounded-lg px-2 py-1.5 text-sm resize-y focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
  const descBtn =
    'px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 transition-colors disabled:opacity-50 self-start'

  const renameDisabled = (current: string, value: string) =>
    disabled || value.trim() === '' || value.trim() === current
  const descDisabled = (current: string | undefined, value: string) =>
    disabled || (current ?? '') === value

  const fieldLabel = 'text-[11px] font-semibold text-gray-400 uppercase tracking-wide'

  // One row for a variant (addon) or addition (modifier). Both share the same
  // layout — only the stable id (label vs key) and the modifier-only group badge
  // differ — so a single helper keeps the two lists visually identical.
  const renderEditRow = (kind: 'addon' | 'modifier', id: string, idx: number) => {
    const isAddon = kind === 'addon'
    const order = isAddon ? addonOrder : modOrder
    const setOrder = isAddon ? setAddonOrder : setModOrder
    const names = isAddon ? addonNames : modNames
    const setNames = isAddon ? setAddonNames : setModNames
    const priceVals = isAddon ? addonVals : modVals
    const setPriceVals = isAddon ? setAddonVals : setModVals
    const durVals = isAddon ? addonDurVals : modDurVals
    const setDurVals = isAddon ? setAddonDurVals : setModDurVals
    const descVals = isAddon ? addonDesc : modDesc
    const setDescVals = isAddon ? setAddonDesc : setModDesc

    const addon = isAddon ? addonByLabel.get(id) : undefined
    const mod = isAddon ? undefined : modByKey.get(id)
    if (isAddon ? !addon : !mod) return null

    const currentName = isAddon ? addon!.label : mod!.label
    const priceCurrent = isAddon ? addon!.price_diff : mod!.price_diff
    const durCurrent = (isAddon ? addon!.duration_diff : mod!.duration_diff) ?? 0
    const descCurrent = isAddon ? addon!.description : mod!.description
    const groupBadge = isAddon ? undefined : mod!.group?.trim()

    const target: PriceTarget = isAddon ? { kind: 'addon', label: id } : { kind: 'modifier', key: id }
    const descTarget: DescriptionTarget = isAddon
      ? { kind: 'addon', label: id }
      : { kind: 'modifier', key: id }

    const nameVal = names[id] ?? ''
    const priceVal = priceVals[id] ?? ''
    const durVal = durVals[id] ?? ''
    const descVal = descVals[id] ?? ''

    return (
      <div key={`${kind}:${id}`} className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
        {/* reorder */}
        <div className="flex flex-col gap-1 shrink-0 pt-0.5">
          <button
            type="button"
            className={arrowBtn}
            disabled={disabled || idx === 0}
            onClick={() => setOrder((p) => swap(p, idx, -1))}
            title="Выше"
          >
            ↑
          </button>
          <button
            type="button"
            className={arrowBtn}
            disabled={disabled || idx === order.length - 1}
            onClick={() => setOrder((p) => swap(p, idx, 1))}
            title="Ниже"
          >
            ↓
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Name + group + rename */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={nameVal}
              onChange={(e) => setNames((p) => ({ ...p, [id]: e.target.value }))}
              disabled={disabled}
              className={nameInput}
            />
            {groupBadge && (
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-1 whitespace-nowrap">
                {groupBadge}
              </span>
            )}
            <button
              type="button"
              className={renameBtn}
              disabled={renameDisabled(currentName, nameVal)}
              onClick={() => onRename(target, nameVal)}
            >
              Название
            </button>
          </div>

          {/* Price · duration · delete */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className={fieldLabel}>+Kč</span>
              <input
                type="number"
                value={priceVal}
                onChange={(e) => setPriceVals((p) => ({ ...p, [id]: e.target.value }))}
                disabled={disabled}
                className={input}
              />
              <button
                type="button"
                className={priceBtn}
                disabled={disabled || numOrNull(priceVal) === null || numOrNull(priceVal) === priceCurrent}
                onClick={() => {
                  const v = numOrNull(priceVal)
                  if (v !== null) onPriceEdit(target, v)
                }}
              >
                Цена
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={fieldLabel}>+мин</span>
              <input
                type="number"
                value={durVal}
                onChange={(e) => setDurVals((p) => ({ ...p, [id]: e.target.value }))}
                disabled={disabled}
                className={input}
              />
              <button
                type="button"
                className={durBtn}
                disabled={disabled || numOrNull(durVal) === null || numOrNull(durVal) === durCurrent}
                onClick={() => {
                  const v = numOrNull(durVal)
                  if (v !== null) onDurationEdit(target, v)
                }}
              >
                Время
              </button>
            </div>

            <button
              type="button"
              className={`${delBtn} ml-auto`}
              disabled={disabled}
              onClick={() => (isAddon ? onDeleteAddon(id) : onDeleteModifier(id))}
            >
              Удалить
            </button>
          </div>

          {/* Description */}
          <div className="flex items-start gap-2">
            <textarea
              rows={2}
              value={descVal}
              onChange={(e) => setDescVals((p) => ({ ...p, [id]: e.target.value }))}
              disabled={disabled}
              placeholder={`Описание ${isAddon ? 'варианта' : 'дополнения'} для клиента (показывается по «info» на сайте)`}
              className={descInput}
            />
            <button
              type="button"
              className={descBtn}
              disabled={descDisabled(descCurrent, descVal)}
              onClick={() => onSaveDescription(descTarget, descVal)}
            >
              Описание
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Base */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="font-semibold text-gray-700 text-sm mb-3">База — {group.title}</div>

        {/* Base name */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-xs text-gray-500 w-20">Название</span>
          <input
            type="text"
            value={baseTitle}
            onChange={(e) => setBaseTitle(e.target.value)}
            disabled={disabled}
            className={nameInput}
          />
          <button
            type="button"
            className={renameBtn}
            disabled={renameDisabled(group.title, baseTitle)}
            onClick={() => onRename({ kind: 'base' }, baseTitle)}
          >
            Переименовать
          </button>
        </div>

        {/* Base price */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-500 w-20">Базовая цена</span>
          <input
            type="number"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            disabled={disabled}
            className={input}
          />
          <button
            type="button"
            className={priceBtn}
            disabled={disabled || numOrNull(base) === null || numOrNull(base) === group.base_price}
            onClick={() => {
              const v = numOrNull(base)
              if (v !== null) onPriceEdit({ kind: 'base' }, v)
            }}
          >
            Сменить цену
          </button>
          <span className="text-[11px] text-gray-400">
            переименование/цена пересчитают все combo, offer и junior-копию
          </span>
        </div>

        {/* Base duration */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="text-xs text-gray-500 w-20">Время (мин)</span>
          <input
            type="number"
            value={baseDur}
            onChange={(e) => setBaseDur(e.target.value)}
            disabled={disabled}
            className={input}
          />
          <button
            type="button"
            className={durBtn}
            disabled={disabled || numOrNull(baseDur) === null || numOrNull(baseDur) === baseDuration}
            onClick={() => {
              const v = numOrNull(baseDur)
              if (v !== null) onDurationEdit({ kind: 'base' }, v)
            }}
          >
            Сменить время
          </button>
          <span className="text-[11px] text-gray-400">
            пересчитает длительность всех combo и junior-копий
          </span>
        </div>
      </div>

      {/* Addons */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-semibold text-gray-700 text-sm">
            Варианты (addons) — {group.addons.length}
          </div>
          {group.addons.length > 1 && (
            <button
              type="button"
              className={saveOrderBtn}
              disabled={disabled || !addonOrderChanged}
              onClick={() => onReorder('addon', addonOrder)}
            >
              Сохранить порядок
            </button>
          )}
        </div>
        {group.addons.length === 0 ? (
          <div className="text-sm text-gray-400">Нет вариантов</div>
        ) : (
          <div className="flex flex-col gap-3">
            {addonOrder.map((label, idx) => renderEditRow('addon', label, idx))}
          </div>
        )}
      </div>

      {/* Modifiers */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="font-semibold text-gray-700 text-sm">
            Дополнения (modifiers) — {group.modifiers.length}
          </div>
          {group.modifiers.length > 1 && (
            <button
              type="button"
              className={saveOrderBtn}
              disabled={disabled || !modOrderChanged}
              onClick={() => onReorder('modifier', modOrder)}
            >
              Сохранить порядок
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mb-3">
          Порядок = порядок на сайте. Дополнения одной «группы» показываются на сайте отдельным
          блоком рядом друг с другом (по первому появлению в списке).
        </p>
        {group.modifiers.length === 0 ? (
          <div className="text-sm text-gray-400">Нет дополнений</div>
        ) : (
          <div className="flex flex-col gap-3">
            {modOrder.map((key, idx) => renderEditRow('modifier', key, idx))}
          </div>
        )}
      </div>

      {/* Delete whole service */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <div className="font-semibold text-red-700 text-sm mb-1">Удалить услугу целиком</div>
        <p className="text-xs text-red-600 mb-3">
          Все combo (база + варианты + дополнения) будут скрыты в Noona, addon-group удалён в Strapi,
          junior-копия и маппинг очищены. Коллекция offer (зарплаты/история) не трогается.
        </p>
        <button
          type="button"
          className="px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
          disabled={disabled}
          onClick={onDeleteService}
        >
          Удалить «{group.title}»
        </button>
      </div>
    </div>
  )
}
