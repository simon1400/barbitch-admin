import { useState, useEffect, useCallback, useMemo } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import {
  badgePosCls,
  btnNeutralCls,
  btnPinkCls,
  hintCls,
  inputCls,
  toolbarCardCls,
} from '../../../../ui/kit'
import {
  getWindowCrossSellCandidates,
  sendCrossSellOffers,
  BUCKET_LABEL,
  WINDOW_TOLERANCE_MIN,
  MAX_OFFER_SERVICE_MIN,
  type CrossSellCandidate,
  type SendResult,
} from '../fetch/windowCrossSell'

const DOW_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const fmtDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')} ${DOW_RU[new Date(y, m - 1, d).getDay()]}`
}

// Нейтральный серый чип («отправлено»)
const neutralChipCls = 'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-[#8b857f] bg-[#f6f4f2]'

export default function CrossSellTab() {
  const [cands, setCands] = useState<CrossSellCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [discount, setDiscount] = useState('15 %')
  const [modalOpen, setModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await getWindowCrossSellCandidates(force)
      setCands(data)
      // По умолчанию выделяем все ещё не отправленные
      setSelected(new Set(data.filter((c) => !c.alreadySent).map((c) => c.key)))
    } catch {
      setCands([])
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sendable = useMemo(() => cands.filter((c) => !c.alreadySent), [cands])
  const selectedCands = useMemo(
    () => cands.filter((c) => selected.has(c.key) && !c.alreadySent),
    [cands, selected],
  )

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const allSelected = sendable.length > 0 && sendable.every((c) => selected.has(c.key))
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(sendable.map((c) => c.key)))

  const doSend = async () => {
    setSending(true)
    try {
      const r = await sendCrossSellOffers(selectedCands, discount)
      setResult(r)
      setModalOpen(false)
      await load() // перечитать — отправленные станут «уже отправлено»
    } catch {
      setError('Ошибка отправки писем')
      setModalOpen(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className={toolbarCardCls}>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-[13px] font-bold text-[#4c4844]">
            Скидка в письме:
            <input
              type="text"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className={`${inputCls} w-[90px]`}
            />
          </label>
          <button type="button" onClick={() => load(true)} className={btnNeutralCls}>
            Обновить
          </button>
        </div>
        <button
          type="button"
          disabled={selectedCands.length === 0}
          onClick={() => setModalOpen(true)}
          className={btnPinkCls}
        >
          Отправить ({selectedCands.length})
        </button>
      </div>

      {result && (
        <div className="mb-6 rounded-lg bg-[#e8f6ee] text-[#1d7a3f] text-[13px] font-semibold px-4 py-2.5">
          Отправлено: {result.successful} из {result.total}
          {result.failed > 0 && <span className="text-[#c53030]"> · ошибок: {result.failed}</span>}
        </div>
      )}

      <StatSection title="Дозапись в окно (cross-sell)" id="cross-sell" defaultOpen>
        <p className={`m-0 mb-4 ${hintCls}`}>
          Клиент уже записан в одной категории — предлагаем дозаписаться в другую категорию
          (брови/ресницы/маникюр) в свободное окно мастера, начинающееся ≤{WINDOW_TOLERANCE_MIN} мин
          после конца её процедуры. Предлагаются только короткие услуги (до {MAX_OFFER_SERVICE_MIN}{' '}
          мин). Письмо со скидкой {discount} (упомянуть e-mail при визите) на завтра и послезавтра.
          Один кандидат на клиента/день (по последней брони).
        </p>

        {loading ? (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a39e99]">Načítání…</div>
        ) : error ? (
          <div className="py-12 text-center text-[13px] font-semibold text-[#d61f61]">{error}</div>
        ) : cands.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a39e99]">
            Нет подходящих окон для дозаписи на завтра и послезавтра.
          </div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="px-3 py-[7px] text-left border-b border-[#eee9e6]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="accent-[#e71e6e]"
                      aria-label="Выбрать всех"
                    />
                  </th>
                  <Cell title="Клиент" asHeader />
                  <Cell title="Email" asHeader />
                  <Cell title="День" asHeader />
                  <Cell title="Её запись" asHeader />
                  <Cell title="Предложить" asHeader />
                  <Cell title="Дозапись" asHeader />
                  <Cell title="Статус" asHeader />
                </tr>
              </thead>
              <tbody>
                {cands.map((c) => (
                  <tr
                    key={c.key}
                    className={`transition-colors ${
                      c.alreadySent ? 'opacity-60' : 'hover:bg-[#faf8f7]'
                    }`}
                  >
                    <td className="p-4 border-b border-[#f2efec]">
                      <input
                        type="checkbox"
                        checked={selected.has(c.key) && !c.alreadySent}
                        disabled={c.alreadySent}
                        onChange={() => toggle(c.key)}
                        className="accent-[#e71e6e]"
                        aria-label={`Выбрать ${c.customerName}`}
                      />
                    </td>
                    <Cell title={c.customerName} className="font-bold text-[#161615]" />
                    <Cell title={c.email} className="text-[#8b857f]" />
                    <Cell title={fmtDay(c.date)} />
                    <Cell title={`${BUCKET_LABEL[c.anchorBucket]} · до ${c.anchorEndHHMM}`} />
                    <td className="p-4 border-b border-[#f2efec]">
                      <span className="flex flex-col">
                        <span className="text-[13.5px] font-bold text-[#e71e6e]">
                          {BUCKET_LABEL[c.offerBucket]}
                        </span>
                        <span className="text-[11.5px] font-semibold text-[#8b857f]">
                          {c.serviceTitle} · {c.masterName}
                        </span>
                      </span>
                    </td>
                    <Cell
                      title={`${c.windowStartHHMM} · ${c.serviceDurationMin} мин`}
                      className="text-[#4c4844]"
                    />
                    <td className="p-4 border-b border-[#f2efec]">
                      {c.alreadySent ? (
                        <span className={neutralChipCls}>отправлено</span>
                      ) : (
                        <span className={`whitespace-nowrap ${badgePosCls}`}>новый</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </StatSection>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[rgba(22,22,21,0.45)] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#eee9e6] shadow-[0_10px_28px_rgba(22,22,21,0.14)] w-full max-w-[560px] max-h-[85vh] overflow-y-auto p-6">
            <h3 className="text-[17px] font-extrabold text-[#161615] mb-2">Отправить предложения</h3>
            <p className={`m-0 mb-4 ${hintCls}`}>
              {selectedCands.length} писем · скидка {discount}. Каждому уйдёт персональное письмо с
              его мастером, временем и ссылкой на дозапись.
            </p>
            <ul className="text-[13px] text-[#4c4844] mb-4 max-h-48 overflow-y-auto border border-[#eee9e6] rounded-lg divide-y divide-[#f2efec]">
              {selectedCands.map((c) => (
                <li key={c.key} className="px-3 py-2">
                  <span className="font-bold text-[#161615]">{c.customerName}</span>{' '}
                  <span className="text-[#a39e99]">{c.email}</span>
                  <br />
                  <span className="text-[11.5px] font-semibold text-[#8b857f]">
                    {fmtDay(c.date)} · {BUCKET_LABEL[c.offerBucket]} ({c.serviceTitle}) ·{' '}
                    {c.masterName} · {c.windowStartHHMM}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={sending}
                className={btnNeutralCls}
              >
                Отмена
              </button>
              <button type="button" onClick={doSend} disabled={sending} className={btnPinkCls}>
                {sending ? 'Отправка…' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
