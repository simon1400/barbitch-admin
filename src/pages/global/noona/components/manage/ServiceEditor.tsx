import { useState } from 'react'
import type { PriceTarget, StrapiAddonGroup } from '../../fetch/manageServices'

interface Props {
  group: StrapiAddonGroup
  onPriceEdit: (target: PriceTarget, newValue: number) => void
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

export const ServiceEditor = ({
  group,
  onPriceEdit,
  onDeleteAddon,
  onDeleteModifier,
  onDeleteService,
  disabled,
}: Props) => {
  const [base, setBase] = useState(String(group.base_price))
  const [addonVals, setAddonVals] = useState<Record<string, string>>(
    Object.fromEntries(group.addons.map((a) => [a.label, String(a.price_diff)])),
  )
  const [modVals, setModVals] = useState<Record<string, string>>(
    Object.fromEntries(group.modifiers.map((m) => [m.key, String(m.price_diff)])),
  )

  const priceBtn =
    'px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50'
  const delBtn =
    'px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50'
  const input =
    'w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'

  return (
    <div className="space-y-4">
      {/* Base */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="font-semibold text-gray-700 text-sm mb-3">База — {group.title}</div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-500">Базовая цена (Kč)</span>
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
            пересчитает все combo и offer по этой услуге
          </span>
        </div>
      </div>

      {/* Addons */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="font-semibold text-gray-700 text-sm mb-3">
          Варианты (addons) — {group.addons.length}
        </div>
        {group.addons.length === 0 ? (
          <div className="text-sm text-gray-400">Нет вариантов</div>
        ) : (
          <div className="flex flex-col gap-2">
            {group.addons.map((a) => (
              <div key={a.label} className="flex flex-wrap items-center gap-3 border-b last:border-b-0 pb-2 last:pb-0">
                <span className="text-sm text-gray-700 flex-1 min-w-40">{a.label}</span>
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
            ))}
          </div>
        )}
      </div>

      {/* Modifiers */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="font-semibold text-gray-700 text-sm mb-3">
          Дополнения (modifiers) — {group.modifiers.length}
        </div>
        {group.modifiers.length === 0 ? (
          <div className="text-sm text-gray-400">Нет дополнений</div>
        ) : (
          <div className="flex flex-col gap-2">
            {group.modifiers.map((m) => (
              <div key={m.key} className="flex flex-wrap items-center gap-3 border-b last:border-b-0 pb-2 last:pb-0">
                <span className="text-sm text-gray-700 flex-1 min-w-40">{m.label}</span>
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
            ))}
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
