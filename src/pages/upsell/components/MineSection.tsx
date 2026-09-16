// «Мои дозаписи за месяц»: две суммы ОТДЕЛЬНО — «Ожидается» (визит впереди или
// смена ещё не закрыта) и «Подтверждено» (владелец опубликовал на закрытии смены).
// Владелец видит всех администраторов и разбивку по людям.
import {
  badgeFaintCls,
  badgeNegCls,
  badgeNeutralCls,
  badgePosCls,
  badgeWarnCls,
  cardCls,
  cardTitleCls,
  colHeadCls,
  hintCls,
  inputCls,
  mutedCls,
  tileAccentCls,
  tileCls,
  tileLabelAccentCls,
  tileLabelCls,
  tileValueAccentCls,
  tileValueCls,
} from '../../../ui/kit'
import { fmtCsDate } from '../../../utils/date'
import { kc } from '../../../utils/money'
import type { UpsellMine, UpsellState } from '../fetch/upsellApi'
import { MINE_SECTION_ID, STATE_LABEL } from '../labels'

const STATE_CLS: Record<UpsellState, string> = {
  awaiting_visit: badgeWarnCls,
  awaiting_confirmation: badgeNeutralCls,
  confirmed: badgePosCls,
  cancelled: badgeNegCls,
  no_commission: badgeFaintCls,
}

const tileSubCls = 'text-[12px] font-semibold text-ink-muted mt-1'
const cellCls = 'py-2 text-[13px] font-semibold text-ink-body'

interface Props {
  month: string
  onMonth: (m: string) => void
  data: UpsellMine | null
  loading: boolean
  error: string | null
  isOwner: boolean
}

export function MineSection({ month, onMonth, data, loading, error, isOwner }: Props) {
  return (
    <section id={MINE_SECTION_ID} className={`${cardCls} px-5 pt-[18px] pb-3 mt-4`}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className={cardTitleCls}>{isOwner ? 'Дозаписи администраторов за месяц' : 'Мои дозаписи за месяц'}</h2>
        <input
          type="month"
          className={`${inputCls} w-auto !py-1.5 !text-[13px]`}
          value={month}
          onChange={(e) => e.target.value && onMonth(e.target.value)}
          aria-label="Месяц"
        />
      </div>
      {error && <div className={`${hintCls} text-neg mb-2`}>{error}</div>}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className={`${tileCls} border border-line`} data-tile="expected">
          <div className={tileLabelCls}>Ожидается</div>
          <div className={tileValueCls}>{data ? kc(data.expectedKc) : '—'}</div>
          <div className={tileSubCls}>визит впереди или смена ещё не закрыта</div>
        </div>
        <div className={tileAccentCls} data-tile="confirmed">
          <div className={tileLabelAccentCls}>Подтверждено</div>
          <div className={tileValueAccentCls}>{data ? kc(data.confirmedKc) : '—'}</div>
          <div className={tileSubCls}>владелец опубликовал на закрытии смены</div>
        </div>
      </div>
      {isOwner && data?.byAdmin && data.byAdmin.length > 0 && (
        <table className="w-full mb-3" data-table="by-admin">
          <thead>
            <tr>
              <th className={`${colHeadCls} text-left pb-1`}>Администратор</th>
              <th className={`${colHeadCls} text-right pb-1`}>Дозаписей</th>
              <th className={`${colHeadCls} text-right pb-1`}>Ожидается</th>
              <th className={`${colHeadCls} text-right pb-1`}>Подтверждено</th>
            </tr>
          </thead>
          <tbody>
            {data.byAdmin.map((a) => (
              <tr key={a.adminUsername} className="border-t border-line-soft">
                <td className={`${cellCls} font-bold text-ink`}>{a.adminUsername}</td>
                <td className={`${cellCls} text-right`}>{a.count}</td>
                <td className={`${cellCls} text-right`}>{kc(a.expectedKc)}</td>
                <td className={`${cellCls} text-right text-brand-dark font-bold`}>{kc(a.confirmedKc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {loading && !data && <div className={mutedCls}>Загрузка…</div>}
      {data && data.rows.length === 0 && <div className={`${hintCls} pb-2`}>В этом месяце дозаписей нет.</div>}
      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]" data-table="rows">
            <thead>
              <tr>
                <th className={`${colHeadCls} text-left pb-1`}>Дата</th>
                {isOwner && <th className={`${colHeadCls} text-left pb-1`}>Администратор</th>}
                <th className={`${colHeadCls} text-left pb-1`}>Клиент</th>
                <th className={`${colHeadCls} text-left pb-1`}>Услуга · мастер</th>
                <th className={`${colHeadCls} text-right pb-1`}>Цена</th>
                <th className={`${colHeadCls} text-right pb-1`}>Комиссия</th>
                <th className={`${colHeadCls} text-right pb-1`}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.bookingDocId} className="border-t border-line-soft">
                  <td className={`${cellCls} whitespace-nowrap`}>
                    <b className="text-ink">{fmtCsDate(r.date)}</b> {r.time}
                  </td>
                  {isOwner && <td className={cellCls}>{r.adminUsername}</td>}
                  <td className={`${cellCls} font-bold text-ink`}>{r.clientName}</td>
                  <td className={cellCls}>
                    {r.serviceTitle} · {r.employeeName}
                  </td>
                  <td className={`${cellCls} text-right whitespace-nowrap text-ink`}>{r.totalPrice != null ? kc(r.totalPrice) : '—'}</td>
                  <td className={`${cellCls} text-right whitespace-nowrap font-extrabold text-pos`}>+{kc(r.commissionKc)}</td>
                  <td className={`${cellCls} text-right`}>
                    <span className={STATE_CLS[r.state]}>{STATE_LABEL[r.state]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
