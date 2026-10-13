// Карточка «Склад» (s251): что закончилось и что ниже минимума — на «Сегодня»
// (owner/manager) и в кабинете администратора. Как у «Дней рождения»:
//   • StockCardView — только показ (данные приносит «Сегодня» вместе с остальными источниками);
//   • StockCard — сама загружает (кабинет администратора).
// Цен здесь нет ни у кого — сводка сервера их не содержит.
// s252: + уже заказанное (бейдж «заказано», в счётчик не идёт), заказы не пришли в срок, инвентура
// недели (администратору — всегда, руководству — со вторника), руководству — приходы без затраты.
// Счётчик — `stockAttentionCount` (stockText.ts), тот же для «Сегодня».
import { useEffect, useState } from 'react'

import { errMsg } from '../../../lib/errMsg'
import { TodayCard, TodayRow } from '../../today/components/TodayCard'
import { badgeFaintCls, badgeNegCls, badgeWarnCls, hintCls } from '../../../ui/kit'
import { fetchStockAttention, type StockAttention } from '../fetch/stock'
import { smallCls, stockAttentionCount } from '../stockText'

const MAX_ROWS = 8

interface ViewProps {
  data: StockAttention | null
  loading: boolean
  error?: string | null
  hideOk?: boolean
  /** кабинет администратора: инвентура — его дело с понедельника, приходов без затраты не видит */
  forAdmin?: boolean
}

export function StockCardView({ data, loading, error, hideOk, forAdmin = false }: ViewProps) {
  const rows = data ? [...data.out.map((i) => ({ ...i, out: true })), ...data.low.map((i) => ({ ...i, out: false }))] : []
  const empty = data != null && data.total === 0
  const toOrder = rows.filter((i) => !i.onOrder).length
  const inv = data?.inventory
  const showInv = !!inv && inv.remaining > 0 && (forAdmin || !inv.isMonday)
  const overdue = data?.orders?.overdue ?? []
  const waiting = data?.orders?.waiting ?? 0
  const needsCost = forAdmin ? 0 : (data?.orders?.needsCost ?? 0)
  const link = showInv && forAdmin ? { to: '/stock?tab=inventory', label: 'Inventura' } : toOrder ? { to: '/stock?tab=order', label: 'Co objednat' } : overdue.length || needsCost ? { to: '/stock?tab=orders', label: 'Objednávky' } : { to: '/stock', label: 'Sklad' }
  return (
    <TodayCard
      id="stock"
      title="Склад"
      count={data ? stockAttentionCount(data, { forAdmin }) : null}
      loading={loading}
      error={error}
      hideOk={hideOk}
      okText={empty ? 'Позиции ещё не заведены' : waiting ? `Всё в наличии · ждём заказов: ${waiting}` : 'Всё в наличии'}
      link={link}
    >
      {showInv && (
        <TodayRow to="/stock?tab=inventory" aside={<span className={`${badgeWarnCls} whitespace-nowrap`}>{inv!.remaining}</span>}>
          <b className="text-ink" data-inventory-remaining={inv!.remaining}>
            {inv!.isMonday ? 'Сегодня инвентура' : 'Инвентура с понедельника не закончена'}
          </b>
          <div className={smallCls}>осталось пересчитать позиций: {inv!.remaining}</div>
        </TodayRow>
      )}
      {overdue.map((o) => (
        <TodayRow key={o.documentId} to="/stock?tab=orders" aside={<span className={`${badgeNegCls} whitespace-nowrap`}>{o.days} дн.</span>}>
          <b className="text-ink" data-overdue-order={o.supplier || '-'}>
            Заказ не пришёл: {o.supplier || 'без поставщика'}
          </b>
        </TodayRow>
      ))}
      {needsCost > 0 && (
        <TodayRow to="/stock?tab=orders" aside={<span className={`${badgeWarnCls} whitespace-nowrap`}>{needsCost}</span>}>
          <b className="text-ink" data-needs-cost={needsCost}>
            Приход без затраты
          </b>
          <div className={smallCls}>впишите сумму в заказе — «Zapsat náklad»</div>
        </TodayRow>
      )}
      {rows.slice(0, MAX_ROWS).map((i) => (
        <TodayRow
          key={i.documentId}
          to={`/stock/i/${encodeURIComponent(i.documentId)}`}
          aside={
            i.onOrder ? (
              <span className={`${badgeFaintCls} whitespace-nowrap`}>заказано</span>
            ) : (
              <span className={`${i.out ? badgeNegCls : badgeWarnCls} whitespace-nowrap`}>{i.out ? 'закончилось' : 'мало'}</span>
            )
          }
        >
          <b className="text-ink">{i.name}</b>
          <div className={smallCls}>
            {i.location} · {i.qtyText} (мин. {i.minText})
          </div>
        </TodayRow>
      ))}
      {rows.length > MAX_ROWS && <div className={hintCls}>…и ещё {rows.length - MAX_ROWS}</div>}
      {forAdmin && waiting > 0 && (
        <div className={hintCls} data-waiting={waiting}>
          Ждём заказов: {waiting} — когда придут, «Přijato» в Sklad → Objednávky
        </div>
      )}
      {data && data.countDue > 0 && !showInv && (
        <div className={hintCls} data-count-due={data.countDue}>
          Давно не пересчитывали: {data.countDue}
        </div>
      )}
    </TodayCard>
  )
}

export function StockCard({ forAdmin = false }: { forAdmin?: boolean }) {
  const [data, setData] = useState<StockAttention | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    fetchStockAttention()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errMsg(e, 'Не удалось загрузить')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])
  return <StockCardView data={data} loading={loading} error={error} forAdmin={forAdmin} />
}
