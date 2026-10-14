// Три действия склада на телефоне (s251, §3.2 плана): «Spočítat» (пересчёт — подставлен
// текущий остаток, «OK, jak bylo» одним тапом), «Přišlo» (приход), «Došlo» (закончилось
// совсем или «málo» — без подсчёта). Количество — упаковки + штуки, если у позиции
// упаковка больше одной штуки. Всё считает сервер: форма шлёт только введённое.
// s258: у ml/g упаковки дробные («0,2 bal. = 1000 ml» — подсказка считается на лету),
// ошибка сервера — под своим полем.
import { useState } from 'react'

import { btnDangerCls, btnNeutralCls, btnPinkCls, hintCls, inputCls } from '../../../ui/kit'
import { packsHint, postStockMove, splitQty, stockErrorField, type MoveInput, type StockItem } from '../fetch/stock'

type Mode = null | 'count' | 'in' | 'out'

const bigBtn = 'flex-1 min-w-0 !px-2 !py-3 !text-[14px]'
const qtyInputCls = `${inputCls} w-full text-center !text-[18px]`

interface Props {
  item: StockItem
  onSaved: (item: StockItem) => void
  /** крупные кнопки (экран QR-ярлыка) */
  large?: boolean
}

export function MoveForm({ item, onSaved, large }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const [packs, setPacks] = useState('')
  const [units, setUnits] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<[string | null, string] | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const withPacks = item.packSize > 1
  const pieces = item.unit === 'ks'
  const fieldErr = (k: string) =>
    error && error[0] === k ? (
      <span className="text-[12.5px] font-semibold text-neg mt-1" data-field-error={k}>
        {error[1]}
      </span>
    ) : null

  const open = (m: Mode) => {
    setError(null)
    setDone(null)
    setNote('')
    if (m === 'count') {
      const s = splitQty(item.qty, item.packSize)
      setPacks(withPacks ? String(s.packs) : '')
      setUnits(String(s.units))
    } else {
      setPacks('')
      setUnits('')
    }
    setMode(mode === m ? null : m)
  }

  const send = async (body: MoveInput) => {
    setBusy(true)
    setError(null)
    try {
      const res = await postStockMove(item.documentId, { ...body, ...(note.trim() ? { note: note.trim() } : {}) })
      setMode(null)
      setDone(`Uloženo: ${res.item.qtyText}`)
      onSaved(res.item)
    } catch (e) {
      setError(stockErrorField(e))
    } finally {
      setBusy(false)
    }
  }

  const qtyBody = (kind: 'count' | 'in'): MoveInput => ({
    kind,
    ...(withPacks && packs.trim() !== '' ? { packs: packs.trim() } : {}),
    ...(units.trim() !== '' ? { units: units.trim() } : {}),
  })

  const btn = large ? `${bigBtn} !py-4 !text-[16px]` : bigBtn
  return (
    <div className="flex flex-col gap-2.5" data-move-form={item.documentId}>
      <div className="flex gap-2">
        <button type="button" className={`${mode === 'count' ? btnPinkCls : btnNeutralCls} ${btn}`} onClick={() => open('count')} data-act="count">
          Spočítat
        </button>
        <button type="button" className={`${mode === 'in' ? btnPinkCls : btnNeutralCls} ${btn}`} onClick={() => open('in')} data-act="in">
          Přišlo
        </button>
        <button type="button" className={`${mode === 'out' ? btnPinkCls : btnDangerCls} ${btn}`} onClick={() => open('out')} data-act="out">
          Došlo
        </button>
      </div>

      {(mode === 'count' || mode === 'in') && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send(qtyBody(mode))
          }}
        >
          <div className={hintCls}>{mode === 'count' ? 'Kolik je teď na místě:' : 'Kolik přišlo:'}</div>
          <div className="flex gap-2 items-end">
            {withPacks && (
              <label className="flex-1 min-w-0 flex flex-col">
                <span className={hintCls}>
                  balení (à {item.packSize} {item.unit}{pieces ? '' : ', i desetinné'})
                </span>
                <input
                  className={qtyInputCls}
                  inputMode={pieces ? 'numeric' : 'decimal'}
                  value={packs}
                  onChange={(e) => setPacks(e.target.value)}
                  data-field="packs"
                  autoFocus
                />
                {fieldErr('packs')}
              </label>
            )}
            <label className="flex-1 min-w-0 flex flex-col">
              <span className={hintCls}>{withPacks ? `+ ${item.unit} navíc` : item.unit}</span>
              <input
                className={qtyInputCls}
                inputMode={pieces ? 'numeric' : 'decimal'}
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                data-field="units"
                autoFocus={!withPacks}
              />
              {fieldErr('units')}
            </label>
          </div>
          {withPacks && !pieces && (
            <div className={hintCls} data-packs-hint>
              {packsHint(packs, item.packSize, item.unit) ?? `Např. 0,2 bal. = ${Math.round(item.packSize * 0.2 * 100) / 100} ${item.unit}.`}
            </div>
          )}
          <input
            className={inputCls}
            placeholder="Poznámka (nepovinné)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            data-field="note"
          />
          <div className="flex gap-2 flex-wrap">
            <button type="submit" className={`${btnPinkCls} flex-1`} disabled={busy} data-submit={mode}>
              {mode === 'count' ? 'Uložit stav' : 'Přidat na sklad'}
            </button>
            {mode === 'count' && (
              <button
                type="button"
                className={btnNeutralCls}
                disabled={busy}
                data-submit="same"
                onClick={() => {
                  const s = splitQty(item.qty, item.packSize)
                  void send({ kind: 'count', ...(withPacks ? { packs: s.packs } : {}), units: s.units })
                }}
              >
                OK, jak bylo ({item.qtyText})
              </button>
            )}
          </div>
        </form>
      )}

      {mode === 'out' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={`${btnDangerCls} flex-1`} disabled={busy} onClick={() => void send({ kind: 'out', mode: 'empty' })} data-submit="empty">
              Došlo úplně (0)
            </button>
            {item.min > 0 && item.status === 'ok' && (
              <button type="button" className={`${btnNeutralCls} flex-1`} disabled={busy} onClick={() => void send({ kind: 'out', mode: 'low' })} data-submit="low">
                Dochází (méně než {item.minText})
              </button>
            )}
          </div>
          <input
            className={inputCls}
            placeholder="Poznámka (nepovinné)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            data-field="note"
          />
        </div>
      )}

      {error && error[0] === null && (
        <div className="text-[12.5px] font-semibold text-neg" data-error>
          {error[1]}
        </div>
      )}
      {done && !mode && (
        <div className="text-[12.5px] font-semibold text-pos" data-done>
          ✓ {done}
        </div>
      )}
    </div>
  )
}
