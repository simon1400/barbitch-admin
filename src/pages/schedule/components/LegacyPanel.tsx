// «Заменить старые блоки» (решение владельца s218): после шаблона в календаре
// остаются прежние повторяющиеся серии (выходные из Noona, «Blokace» руками),
// которые теперь дублируют план. Сервер предлагает только те, что план покрывает
// целиком; удаляются лишь их будущие блоки. Отпуска, разовые блоки и блоки,
// ждущие согласования, сюда не попадают.
import { useEffect, useState } from 'react'

import { btnDangerCls, btnNeutralCls, cardPadCls, cardTitleCls, chipCls, hintCls } from '../../../ui/kit'
import { fmtCsDate } from '../../../utils/date'
import { fetchLegacy, replaceLegacy, type LegacySeries } from '../fetch/schedule'

interface Props {
  personal: string
  name: string
  onDone: (deleted: number) => void
  onClose: () => void
}

export function LegacyPanel({ personal, name, onDone, onClose }: Props) {
  const [items, setItems] = useState<LegacySeries[] | null>(null)
  const [horizon, setHorizon] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchLegacy(personal)
      .then((r) => {
        if (!alive) return
        setItems(r.items || [])
        setHorizon(r.horizon ?? null)
        setPicked(new Set((r.items || []).map((i) => i.key)))
      })
      .catch((e) => alive && setError((e as Error).message))
    return () => {
      alive = false
    }
  }, [personal])

  const total = (items || []).filter((i) => picked.has(i.key)).reduce((s, i) => s + i.count, 0)

  const run = async () => {
    if (!picked.size) return
    if (!window.confirm(`Удалить ${total} старых блоков (${name})? Их заменяет план — выходные останутся закрытыми.`)) return
    setBusy(true)
    setError(null)
    try {
      const r = await replaceLegacy(personal, [...picked])
      onDone(r.deleted)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  if (items && !items.length && !error) return null

  return (
    <div className={cardPadCls} data-testid="legacy-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={cardTitleCls}>Старые блоки, которые теперь заменяет план · {name}</h3>
          <p className={`${hintCls} m-0 mt-1`}>
            Эти повторяющиеся серии дублируют шаблон: план закрывает те же часы. Удаляются только будущие блоки в пределах
            окна записи{horizon ? ` (до ${fmtCsDate(horizon)})` : ''} — дальше блоков плана ещё нет, старые остаются до следующей замены.
          </p>
        </div>
        <button type="button" className={btnNeutralCls} onClick={onClose}>
          Оставить как есть
        </button>
      </div>
      {!items && !error && <p className={hintCls}>Загрузка…</p>}
      {items && items.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {items.map((i) => (
            <label key={i.key} className={chipCls(picked.has(i.key)) + ' !rounded-lg'} data-key={i.key}>
              <input
                type="checkbox"
                className="accent-brand"
                checked={picked.has(i.key)}
                onChange={(e) =>
                  setPicked((cur) => {
                    const next = new Set(cur)
                    if (e.target.checked) next.add(i.key)
                    else next.delete(i.key)
                    return next
                  })
                }
              />
              <span>
                {i.title} · {i.weekdays.join(', ')} · {i.time} · {fmtCsDate(i.first)} – {fmtCsDate(i.last)} ({i.count}×)
                {i.kind === 'mirror' ? ' · из Noona' : i.createdBy ? ` · ${i.createdBy}` : ''}
                {i.later > 0 && ` · ещё ${i.later} за окном записи останутся`}
              </span>
            </label>
          ))}
          <div>
            <button type="button" className={btnDangerCls} disabled={busy || !picked.size} onClick={run} data-testid="legacy-delete">
              Удалить выбранные ({total})
            </button>
          </div>
        </div>
      )}
      {error && <p className="m-0 mt-2 text-[12.5px] font-semibold text-neg">{error}</p>}
    </div>
  )
}
