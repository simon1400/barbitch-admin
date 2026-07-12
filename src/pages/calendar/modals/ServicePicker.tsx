// Пикер услуги (kategorie → služba → varianta → doplňky) — общий для
// «Nová rezervace» и «Změnit službu». Состояние выбора (ServiceSelection)
// держит родитель, пикер только рисует и репортит onChange.

import { useEffect, useMemo, useState } from 'react'
import type { CatalogService } from '../fetch/engineApi'
import { inputCls, labelCls, type ServiceSelection } from './helpers'
import { OptionRow } from './ui'

export const ServicePicker = ({
  catalog,
  sel,
  onChange,
}: {
  catalog: CatalogService[]
  sel: ServiceSelection
  onChange: (v: ServiceSelection) => void
}) => {
  const categories = useMemo(() => [...new Set(catalog.map((s) => s.category))], [catalog])
  const [category, setCategory] = useState('')
  useEffect(() => {
    if (!category && categories.length) setCategory(sel.service?.category || categories[0])
  }, [categories, category, sel.service])
  const services = useMemo(() => catalog.filter((s) => s.category === category), [catalog, category])
  useEffect(() => {
    // смена категории → первая её услуга; сброс варианта/допов
    if (services.length && !services.some((s) => s.documentId === sel.service?.documentId)) {
      onChange({ service: services[0], variantLabel: '', modKeys: [] })
    }
  }, [services, sel.service, onChange])

  const svc = sel.service
  const toggleMod = (key: string) => {
    if (!svc) return
    const mod = svc.modifiers.find((m) => m.key === key)
    const cur = sel.modKeys
    let next: string[]
    if (cur.includes(key)) {
      next = cur.filter((k) => k !== key)
    } else {
      // взаимоисключающая группа: снимаем других из той же группы
      const sameGroup = mod?.group
        ? svc.modifiers.filter((m) => m.group === mod.group && m.key !== key).map((m) => m.key)
        : []
      next = [...cur.filter((k) => !sameGroup.includes(k)), key]
    }
    onChange({ ...sel, modKeys: next })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className={labelCls}>Kategorie</span>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelCls}>Služba</span>
          <select
            className={inputCls}
            value={svc?.documentId || ''}
            onChange={(e) =>
              onChange({
                service: services.find((s) => s.documentId === e.target.value) || null,
                variantLabel: '',
                modKeys: [],
              })
            }
          >
            {services.map((s) => (
              <option key={s.documentId} value={s.documentId}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {svc && svc.variants.length > 0 && (
        <div>
          <span className={labelCls}>Varianta</span>
          <div className="space-y-1">
            <OptionRow
              radio
              active={!sel.variantLabel}
              name="Základní varianta"
              priceDiff={0}
              onClick={() => onChange({ ...sel, variantLabel: '' })}
            />
            {svc.variants.map((v) => (
              <OptionRow
                key={v.label}
                radio
                active={sel.variantLabel === v.label}
                name={v.label}
                hint={v.durationDiff ? `+${v.durationDiff} min` : undefined}
                priceDiff={v.priceDiff}
                onClick={() => onChange({ ...sel, variantLabel: v.label })}
              />
            ))}
          </div>
        </div>
      )}

      {svc && svc.modifiers.length > 0 && (
        <div>
          <span className={labelCls}>Doplňky</span>
          <div className="space-y-1">
            {svc.modifiers.map((m) => (
              <OptionRow
                key={m.key}
                radio={false}
                active={sel.modKeys.includes(m.key)}
                name={m.label}
                hint={m.group ? `skupina: ${m.group}` : undefined}
                priceDiff={m.priceDiff}
                onClick={() => toggleMod(m.key)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
