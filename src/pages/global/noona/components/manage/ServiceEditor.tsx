import { useState } from 'react'
import type { PriceTarget, RenameTarget, StrapiAddonGroup } from '../../fetch/manageServices'

interface Props {
  group: StrapiAddonGroup
  onPriceEdit: (target: PriceTarget, newValue: number) => void
  onRename: (target: RenameTarget, newName: string) => void
  onReorder: (kind: 'addon' | 'modifier', orderedIds: string[]) => void
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
  onPriceEdit,
  onRename,
  onReorder,
  onDeleteAddon,
  onDeleteModifier,
  onDeleteService,
  disabled,
}: Props) => {
  const [base, setBase] = useState(String(group.base_price))
  const [baseTitle, setBaseTitle] = useState(group.title)
  const [addonVals, setAddonVals] = useState<Record<string, string>>(
    Object.fromEntries(group.addons.map((a) => [a.label, String(a.price_diff)])),
  )
  const [modVals, setModVals] = useState<Record<string, string>>(
    Object.fromEntries(group.modifiers.map((m) => [m.key, String(m.price_diff)])),
  )
  // Rename inputs are keyed by the STABLE identifier (addon label / modifier key),
  // so editing the name never breaks the price/delete buttons that reference it.
  const [addonNames, setAddonNames] = useState<Record<string, string>>(
    Object.fromEntries(group.addons.map((a) => [a.label, a.label])),
  )
  const [modNames, setModNames] = useState<Record<string, string>>(
    Object.fromEntries(group.modifiers.map((m) => [m.key, m.label])),
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

  const renameDisabled = (current: string, value: string) =>
    disabled || value.trim() === '' || value.trim() === current

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
            {addonOrder.map((label, idx) => {
              const a = addonByLabel.get(label)
              if (!a) return null
              return (
                <div key={label} className="flex flex-wrap items-center gap-3 border-b last:border-b-0 pb-3 last:pb-0">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className={arrowBtn}
                      disabled={disabled || idx === 0}
                      onClick={() => setAddonOrder((p) => swap(p, idx, -1))}
                      title="Выше"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={arrowBtn}
                      disabled={disabled || idx === addonOrder.length - 1}
                      onClick={() => setAddonOrder((p) => swap(p, idx, 1))}
                      title="Ниже"
                    >
                      ↓
                    </button>
                  </div>
                  <input
                    type="text"
                    value={addonNames[a.label] ?? ''}
                    onChange={(e) => setAddonNames((p) => ({ ...p, [a.label]: e.target.value }))}
                    disabled={disabled}
                    className={nameInput}
                  />
                  <button
                    type="button"
                    className={renameBtn}
                    disabled={renameDisabled(a.label, addonNames[a.label] ?? '')}
                    onClick={() => onRename({ kind: 'addon', label: a.label }, addonNames[a.label] ?? '')}
                  >
                    Название
                  </button>
                  <span className="text-xs text-gray-500">+Kč</span>
                  <input
                    type="number"
                    value={addonVals[a.label] ?? ''}
                    onChange={(e) => setAddonVals((p) => ({ ...p, [a.label]: e.target.value }))}
                    disabled={disabled}
                    className={input}
                  />
                  <button
                    type="button"
                    className={priceBtn}
                    disabled={
                      disabled ||
                      numOrNull(addonVals[a.label] ?? '') === null ||
                      numOrNull(addonVals[a.label] ?? '') === a.price_diff
                    }
                    onClick={() => {
                      const v = numOrNull(addonVals[a.label] ?? '')
                      if (v !== null) onPriceEdit({ kind: 'addon', label: a.label }, v)
                    }}
                  >
                    Цена
                  </button>
                  <button
                    type="button"
                    className={delBtn}
                    disabled={disabled}
                    onClick={() => onDeleteAddon(a.label)}
                  >
                    Удалить
                  </button>
                </div>
              )
            })}
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
            {modOrder.map((key, idx) => {
              const m = modByKey.get(key)
              if (!m) return null
              return (
                <div key={key} className="flex flex-wrap items-center gap-3 border-b last:border-b-0 pb-3 last:pb-0">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className={arrowBtn}
                      disabled={disabled || idx === 0}
                      onClick={() => setModOrder((p) => swap(p, idx, -1))}
                      title="Выше"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={arrowBtn}
                      disabled={disabled || idx === modOrder.length - 1}
                      onClick={() => setModOrder((p) => swap(p, idx, 1))}
                      title="Ниже"
                    >
                      ↓
                    </button>
                  </div>
                  <input
                    type="text"
                    value={modNames[m.key] ?? ''}
                    onChange={(e) => setModNames((p) => ({ ...p, [m.key]: e.target.value }))}
                    disabled={disabled}
                    className={nameInput}
                  />
                  {m.group?.trim() && (
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-1 whitespace-nowrap">
                      {m.group.trim()}
                    </span>
                  )}
                  <button
                    type="button"
                    className={renameBtn}
                    disabled={renameDisabled(m.label, modNames[m.key] ?? '')}
                    onClick={() => onRename({ kind: 'modifier', key: m.key }, modNames[m.key] ?? '')}
                  >
                    Название
                  </button>
                  <span className="text-xs text-gray-500">+Kč</span>
                  <input
                    type="number"
                    value={modVals[m.key] ?? ''}
                    onChange={(e) => setModVals((p) => ({ ...p, [m.key]: e.target.value }))}
                    disabled={disabled}
                    className={input}
                  />
                  <button
                    type="button"
                    className={priceBtn}
                    disabled={
                      disabled ||
                      numOrNull(modVals[m.key] ?? '') === null ||
                      numOrNull(modVals[m.key] ?? '') === m.price_diff
                    }
                    onClick={() => {
                      const v = numOrNull(modVals[m.key] ?? '')
                      if (v !== null) onPriceEdit({ kind: 'modifier', key: m.key }, v)
                    }}
                  >
                    Цена
                  </button>
                  <button
                    type="button"
                    className={delBtn}
                    disabled={disabled}
                    onClick={() => onDeleteModifier(m.key)}
                  >
                    Удалить
                  </button>
                </div>
              )
            })}
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
