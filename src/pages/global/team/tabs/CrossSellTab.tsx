import { useState, useEffect, useCallback, useMemo } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
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
      <div className="mb-6 flex justify-between items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Скидка в письме:
            <input
              type="text"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => load(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white shadow-sm hover:bg-gray-50"
          >
            Обновить
          </button>
        </div>
        <button
          type="button"
          disabled={selectedCands.length === 0}
          onClick={() => setModalOpen(true)}
          className="px-5 py-2 rounded-lg text-sm font-semibold border border-primary bg-primary text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Отправить ({selectedCands.length})
        </button>
      </div>

      {result && (
        <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          Отправлено: {result.successful} из {result.total}
          {result.failed > 0 && <span className="text-red-600"> · ошибок: {result.failed}</span>}
        </div>
      )}

      <StatSection title="Дозапись в окно (cross-sell)" id="cross-sell" defaultOpen>
        <p className="text-xs text-gray-400 mb-4">
          Клиент уже записан в одной категории — предлагаем дозаписаться в другую категорию
          (брови/ресницы/маникюр) в свободное окно мастера, начинающееся ≤{WINDOW_TOLERANCE_MIN} мин
          после конца её процедуры. Предлагаются только короткие услуги (до {MAX_OFFER_SERVICE_MIN} мин).
          Письмо со скидкой {discount} (упомянуть e-mail при визите) на завтра и послезавтра. Один
          кандидат на клиента/день (по последней брони).
        </p>

        {loading ? (
          <div className="text-gray-500 py-8 text-center">Načítání…</div>
        ) : error ? (
          <div className="text-red-600 py-8 text-center">{error}</div>
        ) : cands.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">
            Нет подходящих окон для дозаписи на завтра и послезавтра.
          </div>
        ) : (
          <TableWrapper>
            <table className="w-full text-left table-auto min-w-max">
              <thead>
                <tr>
                  <th className="p-4 border-b border-blue-gray-50">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
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
                      c.alreadySent ? 'opacity-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-4 border-b border-blue-gray-50">
                      <input
                        type="checkbox"
                        checked={selected.has(c.key) && !c.alreadySent}
                        disabled={c.alreadySent}
                        onChange={() => toggle(c.key)}
                        aria-label={`Выбрать ${c.customerName}`}
                      />
                    </td>
                    <Cell title={c.customerName} className="font-medium" />
                    <Cell title={c.email} className="text-gray-500" />
                    <Cell title={fmtDay(c.date)} />
                    <Cell title={`${BUCKET_LABEL[c.anchorBucket]} · до ${c.anchorEndHHMM}`} />
                    <td className="p-4 border-b border-blue-gray-50">
                      <span className="flex flex-col">
                        <span className="font-medium text-primary">
                          {BUCKET_LABEL[c.offerBucket]}
                        </span>
                        <span className="text-xs text-gray-600">
                          {c.serviceTitle} · {c.masterName}
                        </span>
                      </span>
                    </td>
                    <Cell
                      title={`${c.windowStartHHMM} · ${c.serviceDurationMin} мин`}
                      className="text-gray-700"
                    />
                    <td className="p-4 border-b border-blue-gray-50">
                      {c.alreadySent ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-600">
                          отправлено
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
                          новый
                        </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Отправить предложения</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedCands.length} писем · скидка {discount}. Каждому уйдёт персональное письмо с
              его мастером, временем и ссылкой на дозапись.
            </p>
            <ul className="text-sm text-gray-700 mb-4 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {selectedCands.map((c) => (
                <li key={c.key} className="px-3 py-2">
                  <span className="font-medium">{c.customerName}</span>{' '}
                  <span className="text-gray-400">{c.email}</span>
                  <br />
                  <span className="text-xs text-gray-500">
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
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={doSend}
                disabled={sending}
                className="px-5 py-2 rounded-lg text-sm font-semibold border border-primary bg-primary text-white hover:opacity-90 disabled:opacity-50"
              >
                {sending ? 'Отправка…' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
