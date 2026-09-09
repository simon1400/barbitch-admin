// Редактор собственного каталога услуг (salon-service) — замена Noona-модулей
// управления после cutover. Owner-only (/global/catalog).
// ⚠️ Каталог живой: движок бронирования читает эти записи — правки сразу на сайте.
// Дизайн — 1:1 по standalone-макетам владельца (s163): «Каталог услуг» + «Форма
// услуги». Все размеры/отступы/цвета взяты из inline-стилей макета (Montserrat,
// карточки белые с рамкой line/r12, инпуты на surface-input 9px 12px, заголовки колонок 10.5px,
// тоглы 36×21, sticky-бар с blur). Кастомная шкала шрифтов admin не используется —
// только literal px.

import { errMsg } from '../../../lib/errMsg'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cardCls, cardTitleCls, colHeadCls, labelCls } from '../../../ui/kit'
import { palette } from '../../../ui/palette'
import type {
  CatalogModifier,
  CatalogRestriction,
  CatalogServiceFull,
  CatalogVariant,
  MasterOption,
  ServicePayload,
} from './fetch/bookingCatalog'
import {
  applyMasterAssignment,
  createService,
  fetchCatalogServices,
  fetchMasterOptions,
  updateService,
} from './fetch/bookingCatalog'
import { EMPTY_PAYLOAD, cleanRestrictions, isLimited, limitSummary, modKeyOf } from './parts/model'
import type { EditorState } from './parts/model'
import { LIST_GRID, MODIFIER_GRID, VARIANT_GRID, btnNeutralCls, btnPinkCls, inputCls, kickerCls, rowInputCls } from './parts/styles'
import { AddDashedBtn, AllowRow, CountBadge, MoveArrows, RemoveBtn, SectionCard, SuffixInput, Toggle } from './parts/ui'



const CatalogPage = () => {
  const [services, setServices] = useState<CatalogServiceFull[]>([])
  const [masters, setMasters] = useState<MasterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  // documentId мастера, чья панель ограничений сейчас раскрыта (одна за раз)
  const [limitsFor, setLimitsFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [svc, ms] = await Promise.all([fetchCatalogServices(), fetchMasterOptions()])
      setServices(svc)
      setMasters(ms)
    } catch (e: unknown) {
      setError(`Не удалось загрузить каталог: ${errMsg(e, 'ошибка')}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of services) {
      const c = s.category || 'Без категории'
      if (!seen.has(c)) {
        seen.add(c)
        out.push(c)
      }
    }
    return out
  }, [services])

  const mastersOfService = (s: CatalogServiceFull) =>
    masters.filter((m) => m.serviceDocIds.includes(s.documentId) || s.personalDocIds.includes(m.documentId))

  const openEditor = (s: CatalogServiceFull | null) => {
    setNotice('')
    setLimitsFor(null)
    if (!s) {
      setEditor({
        documentId: null,
        payload: { ...EMPTY_PAYLOAD, variants: [], modifiers: [], restrictions: [] },
        masterIds: new Set(),
      })
      return
    }
    setEditor({
      documentId: s.documentId,
      payload: {
        title: s.title,
        category: s.category,
        categoryOrder: s.categoryOrder,
        order: s.order,
        price: s.price,
        durationMin: s.durationMin,
        description: s.description,
        active: s.active,
        onlineBookable: s.onlineBookable,
        variants: s.variants.map((v) => ({ ...v })),
        modifiers: s.modifiers.map((m) => ({ ...m })),
        restrictions: s.restrictions.map((r) => ({
          personalDocId: r.personalDocId,
          allowedVariants: r.allowedVariants ? [...r.allowedVariants] : null,
          allowedModifiers: r.allowedModifiers ? [...r.allowedModifiers] : null,
        })),
      },
      masterIds: new Set(mastersOfService(s).map((m) => m.documentId)),
    })
  }

  const patchPayload = (patch: Partial<ServicePayload>) =>
    setEditor((prev) => (prev ? { ...prev, payload: { ...prev.payload, ...patch } } : prev))

  const patchVariant = (idx: number, patch: Partial<CatalogVariant>) =>
    setEditor((prev) => {
      if (!prev) return prev
      const variants = prev.payload.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v))
      return { ...prev, payload: { ...prev.payload, variants } }
    })

  const patchModifier = (idx: number, patch: Partial<CatalogModifier>) =>
    setEditor((prev) => {
      if (!prev) return prev
      const modifiers = prev.payload.modifiers.map((m, i) => (i === idx ? { ...m, ...patch } : m))
      return { ...prev, payload: { ...prev.payload, modifiers } }
    })

  const removeAt = (kind: 'variants' | 'modifiers', idx: number) =>
    setEditor((prev) => {
      if (!prev) return prev
      const list = prev.payload[kind].filter((_, i) => i !== idx)
      return { ...prev, payload: { ...prev.payload, [kind]: list } }
    })

  const moveAt = (kind: 'variants' | 'modifiers', idx: number, dir: -1 | 1) =>
    setEditor((prev) => {
      if (!prev) return prev
      const list = [...prev.payload[kind]] as (CatalogVariant | CatalogModifier)[]
      const j = idx + dir
      if (j < 0 || j >= list.length) return prev
      ;[list[idx], list[j]] = [list[j], list[idx]]
      return { ...prev, payload: { ...prev.payload, [kind]: list } }
    })

  const toggleMaster = (docId: string) =>
    setEditor((prev) => {
      if (!prev) return prev
      const masterIds = new Set(prev.masterIds)
      if (masterIds.has(docId)) masterIds.delete(docId)
      else masterIds.add(docId)
      return { ...prev, masterIds }
    })

  // Ограничение мастера: null-поля = «разрешено всё»; запись целиком исчезает,
  // когда оба поля снова null.
  const patchRestriction = (
    docId: string,
    patch: Partial<Omit<CatalogRestriction, "personalDocId">>,
  ) =>
    setEditor((prev) => {
      if (!prev) return prev
      const cur = prev.payload.restrictions.find((r) => r.personalDocId === docId)
      const next: CatalogRestriction = {
        personalDocId: docId,
        allowedVariants: cur?.allowedVariants ?? null,
        allowedModifiers: cur?.allowedModifiers ?? null,
        ...patch,
      }
      const rest = prev.payload.restrictions.filter((r) => r.personalDocId !== docId)
      const restrictions =
        next.allowedVariants === null && next.allowedModifiers === null ? rest : [...rest, next]
      return { ...prev, payload: { ...prev.payload, restrictions } }
    })

  // Снятие галочки при «разрешено всё» материализует полный список минус этот пункт;
  // когда снова отмечено всё — возвращаемся к null (в БД ничего не пишем).
  const toggleAllowed = (
    docId: string,
    kind: "allowedVariants" | "allowedModifiers",
    value: string,
    allValues: string[],
  ) => {
    const cur =
      editor?.payload.restrictions.find((r) => r.personalDocId === docId)?.[kind] ?? null
    const list = cur ?? allValues
    const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
    patchRestriction(docId, { [kind]: next.length === allValues.length ? null : next })
  }
  const validate = (p: ServicePayload): string | null => {
    if (!p.title.trim()) return 'Название обязательно'
    if (!(p.durationMin > 0)) return 'Длительность должна быть > 0'
    if (p.price < 0) return 'Цена не может быть отрицательной'
    if (p.variants.some((v) => !v.label.trim())) return 'У варианта пустое название'
    if (p.modifiers.some((m) => !m.label.trim())) return 'У дополнения пустое название'
    const labels = p.variants.map((v) => v.label.trim())
    if (new Set(labels).size !== labels.length) return 'Названия вариантов должны быть уникальны'
    return null
  }

  const handleSave = async () => {
    if (!editor || saving) return
    const problem = validate(editor.payload)
    if (problem) {
      setNotice(`⚠ ${problem}`)
      return
    }
    setSaving(true)
    setNotice('')
    try {
      const payload: ServicePayload = {
        ...editor.payload,
        restrictions: cleanRestrictions(editor.payload, editor.masterIds),
      }
      let docId = editor.documentId
      if (docId) {
        await updateService(docId, payload)
      } else {
        docId = await createService(payload)
      }
      const changed = docId ? await applyMasterAssignment(docId, editor.masterIds, masters) : 0
      setNotice(`✓ Сохранено${changed ? ` (мастера обновлены: ${changed})` : ''}`)
      setEditor(null)
      await load()
    } catch (e: unknown) {
      setNotice(`⚠ Ошибка сохранения: ${errMsg(e, 'unknown')}`)
    } finally {
      setSaving(false)
    }
  }

  // ── редактор (форма услуги) ──

  const renderEditor = (ed: EditorState) => {
    const p = ed.payload
    return (
      <>
        {/* Шапка: назад + хлебная крошка + название + тоглы */}
        <div className={`${cardCls} px-6 py-[18px] mb-4 flex items-center justify-between gap-4 flex-wrap`}>
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              title="К списку"
              className="flex-none w-[38px] h-[38px] rounded-[9px] border border-line-btn bg-white text-ink-muted text-[17px] cursor-pointer transition-colors hover:border-line-btn-hover hover:text-ink"
              onClick={() => setEditor(null)}
            >
              ←
            </button>
            <div className="min-w-0">
              <div className={kickerCls}>
                Каталог услуг{p.category ? ` · ${p.category}` : ''}
              </div>
              <h1 className="m-0 text-[22px] leading-[1.2] font-extrabold text-ink truncate">
                {p.title || 'Новая услуга'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <Toggle checked={p.active} label="Активна" onChange={(v) => patchPayload({ active: v })} />
            <Toggle
              checked={p.onlineBookable}
              label="Онлайн-запись"
              onChange={(v) => patchPayload({ onlineBookable: v })}
            />
          </div>
        </div>

        {/* Основное */}
        <SectionCard title="Основное" hint="Название, цена и длительность — то, что клиент видит при записи.">
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-3">
              <div>
                <label className={labelCls}>Название</label>
                <input
                  className={inputCls}
                  value={p.title}
                  onChange={(e) => patchPayload({ title: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Категория</label>
                <input
                  className={inputCls}
                  list="catalog-categories"
                  value={p.category}
                  onChange={(e) => patchPayload({ category: e.target.value })}
                />
                <datalist id="catalog-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Цена</label>
                <SuffixInput value={p.price} suffix="Kč" suffixPad={38} onChange={(n) => patchPayload({ price: n })} />
              </div>
              <div>
                <label className={labelCls}>Время</label>
                <SuffixInput
                  value={p.durationMin}
                  suffix="мин"
                  suffixPad={42}
                  onChange={(n) => patchPayload({ durationMin: n })}
                />
              </div>
              <div>
                <label className={labelCls}>Порядок</label>
                <SuffixInput value={p.order} onChange={(n) => patchPayload({ order: n })} />
              </div>
              <div>
                <label className={labelCls}>Порядок категории</label>
                <SuffixInput value={p.categoryOrder} onChange={(n) => patchPayload({ categoryOrder: n })} />
              </div>
            </div>
            <div>
              <label className={labelCls}>
                Описание{' '}
                <span className="normal-case tracking-normal font-semibold text-ink-placeholder">
                  · info-бейдж на сайте
                </span>
              </label>
              <textarea
                className={`${inputCls} h-16 resize-none text-[14px] leading-[1.5]`}
                value={p.description}
                onChange={(e) => patchPayload({ description: e.target.value })}
              />
            </div>
          </div>
        </SectionCard>

        {/* Варианты */}
        <SectionCard
          title="Варианты"
          badge={p.variants.length}
          hint="Радио-выбор на шаге /extras — клиент выбирает один вариант."
        >
          <div className="overflow-x-auto">
            <div className="min-w-[478px]">
              <div
                className="grid gap-2 pb-[7px] border-b border-line"
                style={{ gridTemplateColumns: VARIANT_GRID }}
              >
                <span />
                <span className={colHeadCls}>Название</span>
                <span className={colHeadCls}>+ Kč</span>
                <span className={colHeadCls}>+ мин</span>
                <span className={colHeadCls}>Описание (info)</span>
                <span />
              </div>
              {p.variants.map((v, idx) => (
                <div
                  key={idx}
                  className={`grid gap-2 items-center py-[7px] ${idx > 0 ? 'border-t border-line-soft' : ''}`}
                  style={{ gridTemplateColumns: VARIANT_GRID }}
                >
                  <MoveArrows onUp={() => moveAt('variants', idx, -1)} onDown={() => moveAt('variants', idx, 1)} />
                  <input
                    className={rowInputCls}
                    placeholder="Название варианта"
                    value={v.label}
                    onChange={(e) => patchVariant(idx, { label: e.target.value })}
                  />
                  <input
                    type="number"
                    className={rowInputCls}
                    value={v.priceDiff}
                    onChange={(e) => patchVariant(idx, { priceDiff: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className={rowInputCls}
                    value={v.durationDiff}
                    onChange={(e) => patchVariant(idx, { durationDiff: Number(e.target.value) })}
                  />
                  <input
                    className={rowInputCls}
                    placeholder="—"
                    value={v.description}
                    onChange={(e) => patchVariant(idx, { description: e.target.value })}
                  />
                  <RemoveBtn onClick={() => removeAt('variants', idx)} />
                </div>
              ))}
            </div>
          </div>
          <AddDashedBtn
            label="Добавить вариант"
            onClick={() =>
              patchPayload({
                variants: [...p.variants, { label: '', priceDiff: 0, durationDiff: 0, description: '' }],
              })
            }
          />
        </SectionCard>

        {/* Дополнения */}
        <SectionCard
          title="Дополнения"
          badge={p.modifiers.length}
          hint="Чекбоксы: клиент отмечает любые. Одинаковая «группа» — взаимоисключающие."
        >
          <div className="overflow-x-auto">
            <div className="min-w-[518px]">
              <div
                className="grid gap-2 pb-[7px] border-b border-line"
                style={{ gridTemplateColumns: MODIFIER_GRID }}
              >
                <span />
                <span className={colHeadCls}>Название</span>
                <span className={colHeadCls}>+ Kč</span>
                <span className={colHeadCls}>+ мин</span>
                <span className={colHeadCls}>Группа</span>
                <span className={colHeadCls}>Описание (info)</span>
                <span />
              </div>
              {p.modifiers.map((m, idx) => (
                <div
                  key={idx}
                  className={`grid gap-2 items-center py-[7px] ${idx > 0 ? 'border-t border-line-soft' : ''}`}
                  style={{ gridTemplateColumns: MODIFIER_GRID }}
                >
                  <MoveArrows onUp={() => moveAt('modifiers', idx, -1)} onDown={() => moveAt('modifiers', idx, 1)} />
                  <input
                    className={rowInputCls}
                    placeholder="Название дополнения"
                    value={m.label}
                    onChange={(e) => patchModifier(idx, { label: e.target.value })}
                  />
                  <input
                    type="number"
                    className={rowInputCls}
                    value={m.priceDiff}
                    onChange={(e) => patchModifier(idx, { priceDiff: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className={rowInputCls}
                    value={m.durationDiff}
                    onChange={(e) => patchModifier(idx, { durationDiff: Number(e.target.value) })}
                  />
                  <input
                    className={rowInputCls}
                    placeholder="—"
                    value={m.group}
                    onChange={(e) => patchModifier(idx, { group: e.target.value })}
                  />
                  <input
                    className={rowInputCls}
                    placeholder="—"
                    value={m.description}
                    onChange={(e) => patchModifier(idx, { description: e.target.value })}
                  />
                  <RemoveBtn onClick={() => removeAt('modifiers', idx)} />
                </div>
              ))}
            </div>
          </div>
          <AddDashedBtn
            label="Добавить дополнение"
            onClick={() =>
              patchPayload({
                modifiers: [
                  ...p.modifiers,
                  { key: '', label: '', priceDiff: 0, durationDiff: 0, group: '', description: '' },
                ],
              })
            }
          />
        </SectionCard>

        {/* Мастера */}
        <SectionCard
          title="Мастера"
          badge={ed.masterIds.size}
          hint="Кто выполняет услугу. Junior-мастер автоматически даёт −20 % от итоговой цены. Шестерёнка на чипе — какие варианты и дополнения мастер делает."
        >
          <div className="flex flex-wrap gap-2.5 content-start">
            {masters.map((m) => {
              const on = ed.masterIds.has(m.documentId)
              const rule = ed.payload.restrictions.find((r) => r.personalDocId === m.documentId)
              const limited = on && isLimited(rule)
              const tunable = p.variants.length > 0 || p.modifiers.length > 0
              return (
                <span
                  key={m.documentId}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full cursor-pointer select-none text-[13.5px] font-bold border transition-all duration-150"
                  style={
                    on
                      ? {
                          background: palette["brand-tint"],
                          borderColor: palette["brand-line"],
                          color: palette["brand-dark"],
                        }
                      : {
                          background: "#fff",
                          borderColor: palette["line-chip"],
                          color: palette["ink-soft"],
                        }
                  }
                  onClick={() => toggleMaster(m.documentId)}
                >
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] flex-none transition-all duration-150"
                    style={
                      on
                        ? { background: palette.brand, color: "#fff" }
                        : { background: palette["surface-track"], color: palette["surface-track"] }
                    }
                  >
                    ✓
                  </span>
                  {m.name}
                  {m.tier === "junior" && (
                    <span className="text-[9.5px] font-bold tracking-[0.05em] uppercase bg-white border border-brand-line text-brand-dark rounded px-[5px] py-px">
                      junior
                    </span>
                  )}
                  {limited && (
                    <span className="text-[10px] font-bold text-ink-soft bg-white border border-line-chip rounded-full px-[7px] py-px whitespace-nowrap">
                      {limitSummary(rule, p.variants.length, p.modifiers.length)}
                    </span>
                  )}
                  {on && tunable && (
                    <button
                      type="button"
                      title="Что этот мастер делает: варианты и дополнения"
                      className="inline-flex items-center justify-center w-[18px] h-[18px] flex-none rounded-full border-0 bg-transparent p-0 text-[13px] leading-none text-brand-dark cursor-pointer transition-opacity hover:opacity-70"
                      onClick={(e) => {
                        e.stopPropagation()
                        setLimitsFor((cur) => (cur === m.documentId ? null : m.documentId))
                      }}
                    >
                      ⚙
                    </button>
                  )}
                </span>
              )
            })}
          </div>

          {/* Панель: что именно делает выбранный мастер */}
          {(() => {
            const docId = limitsFor
            if (!docId || !ed.masterIds.has(docId)) return null
            const master = masters.find((m) => m.documentId === docId)
            if (!master) return null
            const labels = p.variants.map((v) => v.label.trim()).filter(Boolean)
            const keys = p.modifiers.map(modKeyOf).filter(Boolean)
            if (!labels.length && !keys.length) return null
            const rule = ed.payload.restrictions.find((r) => r.personalDocId === docId)
            const allowedV = rule?.allowedVariants ?? null
            const allowedM = rule?.allowedModifiers ?? null
            return (
              <div className="mt-3.5 rounded-xl border border-line bg-surface-input px-4 py-3.5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
                  <div className="text-[13.5px] font-extrabold text-ink">
                    Что делает {master.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-line-btn bg-white px-2.5 py-1 text-[12px] font-bold text-ink-body transition-colors hover:border-line-btn-hover"
                      onClick={() =>
                        patchRestriction(docId, { allowedVariants: null, allowedModifiers: null })
                      }
                    >
                      Разрешить всё
                    </button>
                    <button
                      type="button"
                      title="Свернуть"
                      className="w-[26px] h-[26px] rounded-md border border-line-btn bg-white text-[13px] text-ink-muted transition-colors hover:border-line-btn-hover"
                      onClick={() => setLimitsFor(null)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="text-[11.5px] leading-snug text-ink-hint mb-3">
                  Снятая галочка = мастер этот пункт не делает: на сайте он исчезнет из
                  выбора специалисток, когда клиент отметит такой вариант или дополнение.
                  Базовая услуга разрешена всегда.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {labels.length > 0 && (
                    <div>
                      <div className={`${colHeadCls} mb-1.5`}>
                        Варианты ({(allowedV ?? labels).length}/{labels.length})
                      </div>
                      <div className="grid gap-0.5">
                        {labels.map((label) => (
                          <AllowRow
                            key={label}
                            checked={allowedV === null || allowedV.includes(label)}
                            label={label}
                            onToggle={() => toggleAllowed(docId, "allowedVariants", label, labels)}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="mt-1 px-1.5 text-[11.5px] font-bold text-brand bg-transparent border-0 cursor-pointer hover:opacity-70"
                        onClick={() => patchRestriction(docId, { allowedVariants: [] })}
                      >
                        Только базовая
                      </button>
                    </div>
                  )}
                  {keys.length > 0 && (
                    <div>
                      <div className={`${colHeadCls} mb-1.5`}>
                        Дополнения ({(allowedM ?? keys).length}/{keys.length})
                      </div>
                      <div className="grid gap-0.5">
                        {p.modifiers.map((m, i) => {
                          const key = modKeyOf(m)
                          if (!key) return null
                          return (
                            <AllowRow
                              key={`${key}-${i}`}
                              checked={allowedM === null || allowedM.includes(key)}
                              label={m.label || key}
                              onToggle={() => toggleAllowed(docId, "allowedModifiers", key, keys)}
                            />
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        className="mt-1 px-1.5 text-[11.5px] font-bold text-brand bg-transparent border-0 cursor-pointer hover:opacity-70"
                        onClick={() => patchRestriction(docId, { allowedModifiers: [] })}
                      >
                        Без дополнений
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </SectionCard>

        {/* Sticky-бар сохранения */}
        <div className="fixed left-0 right-0 bottom-0 z-30 bg-[rgba(255,255,255,0.94)] backdrop-blur-[8px] border-t border-line-header">
          <div className="max-w-[1024px] mx-auto px-5 py-[13px] box-border flex items-center justify-between gap-4">
            <span
              className={`text-[12.5px] font-medium truncate ${notice.startsWith('⚠') ? 'text-brand-alert font-semibold' : 'text-ink-hint'}`}
            >
              {notice || 'Правки видны на сайте сразу после сохранения.'}
            </span>
            <div className="flex gap-2.5 flex-none">
              <button type="button" className={btnNeutralCls} onClick={() => setEditor(null)}>
                ← к списку
              </button>
              <button
                type="button"
                className={`${btnPinkCls} px-7 py-[9px]`}
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── список каталога ──

  const renderList = () => (
    <>
      {/* Шапка списка */}
      <div className={`${cardCls} px-6 py-[18px] mb-4 flex items-center justify-between gap-4 flex-wrap`}>
        <div>
          <div className={kickerCls}>Rezervace · онлайн-запись</div>
          <h1 className="m-0 flex items-center gap-2.5 text-[22px] leading-[1.2] font-extrabold text-ink">
            Каталог услуг {services.length > 0 && <CountBadge n={services.length} big />}
          </h1>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className={btnNeutralCls} onClick={load} disabled={loading}>
            Обновить
          </button>
          <button type="button" className={`${btnPinkCls} px-[22px] py-[9px]`} onClick={() => openEditor(null)}>
            ＋ Услуга
          </button>
        </div>
      </div>

      {notice && <p className="text-[12.5px] font-medium text-ink-hint mb-3">{notice}</p>}

      {categories.map((cat) => {
        const items = services.filter((s) => (s.category || 'Без категории') === cat)
        return (
          <div key={cat} className={`${cardCls} pt-[18px] px-6 pb-2.5 mb-3.5`}>
            <div className="flex items-center gap-2.5 pb-3">
              <h2 className={cardTitleCls}>{cat}</h2>
              <CountBadge n={items.length} />
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <div
                  className="grid gap-3 items-center pb-[7px] border-b border-line"
                  style={{ gridTemplateColumns: LIST_GRID }}
                >
                  <span className={colHeadCls}>Услуга</span>
                  <span className={colHeadCls}>Цена</span>
                  <span className={colHeadCls}>Время</span>
                  <span className={colHeadCls}>Опции</span>
                  <span className={colHeadCls}>Мастера</span>
                  <span />
                </div>
                {items.map((s, i) => {
                  const ms = mastersOfService(s)
                  return (
                    <div
                      key={s.documentId}
                      className={`grid gap-3 items-center py-[11px] px-2 -mx-2 rounded-lg transition-colors hover:bg-surface-hover ${i > 0 ? 'border-t border-line-soft' : ''}`}
                      style={{ gridTemplateColumns: LIST_GRID }}
                    >
                      <span className="text-[14px] font-bold text-ink">
                        {s.title}
                        {!s.active && (
                          <span className="ml-2 align-middle text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-px whitespace-nowrap">
                            выключена
                          </span>
                        )}
                        {s.active && !s.onlineBookable && (
                          <span className="ml-2 align-middle text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-px whitespace-nowrap">
                            без онлайн-записи
                          </span>
                        )}
                      </span>
                      <span className="text-[14px] font-bold text-ink whitespace-nowrap">{s.price} Kč</span>
                      <span className="text-[13px] font-semibold text-ink-soft whitespace-nowrap">
                        {s.durationMin} мин
                      </span>
                      <span className="flex gap-[5px] flex-wrap">
                        {s.variants.length > 0 && (
                          <span className="text-[11px] font-bold text-ink-muted bg-surface-input rounded-full px-[9px] py-[3px] whitespace-nowrap">
                            вар. {s.variants.length}
                          </span>
                        )}
                        {s.modifiers.length > 0 && (
                          <span className="text-[11px] font-bold text-ink-muted bg-surface-input rounded-full px-[9px] py-[3px] whitespace-nowrap">
                            доп. {s.modifiers.length}
                          </span>
                        )}
                      </span>
                      <span className="text-[12.5px] font-semibold text-ink-soft leading-[1.45]">
                        {ms.length ? (
                          ms.map((m) => m.name.split(' ')[0]).join(', ')
                        ) : (
                          <span className="text-red-500">нет мастеров</span>
                        )}
                      </span>
                      <span className="text-right">
                        <button
                          type="button"
                          className="inline-block px-3.5 py-[7px] rounded-lg border border-line-btn bg-white text-ink-body text-[12.5px] font-bold whitespace-nowrap transition-all duration-150 cursor-pointer hover:border-brand hover:text-brand"
                          onClick={() => openEditor(s)}
                        >
                          Редактировать
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )

  return (
    <div
      className={`max-w-[1024px] mx-auto box-border px-5 pt-6 text-ink ${editor ? 'pb-[120px]' : 'pb-[60px]'}`}
    >
      {error && <p className="text-[12.5px] font-semibold text-red-600 mb-3">{error}</p>}
      {loading ? (
        <div className="text-[13px] font-medium text-ink-hint">Загрузка…</div>
      ) : editor ? (
        renderEditor(editor)
      ) : (
        renderList()
      )}
    </div>
  )
}

export default CatalogPage
