import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART } from '../../../../ui/chartColors'

interface Row {
  label: string
  revenue: number
  visits: number
}

interface Props {
  data: Row[]
  title?: string
}

const fmtMoney = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`

// Кастомный тултип: выручка + визиты. Визиты НЕ рисуются второй линией со своей осью —
// двойная ось Y (деньги слева, штуки справа) делала линии визуально сопоставимыми,
// хотя шкалы разные. Визиты видны при наведении и в таблице под графиком.
const ChartTooltip = ({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string
  payload?: { payload: Row }[]
}) => {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className={'bg-white border border-line rounded-[10px] px-3 py-2 shadow-pop'}>
      <div className={'text-[12px] font-extrabold text-ink mb-1'}>{label}</div>
      <div className={'text-[12px] font-bold text-brand'}>{fmtMoney(row.revenue)}</div>
      <div className={'text-[11px] font-semibold text-ink-soft'}>{row.visits} визитов</div>
    </div>
  )
}

export const RevenueBarChart = ({ data, title }: Props) => (
  <div className={'w-full'}>
    {title && (
      <h3 className={'m-0 mb-3.5 text-[15px] font-extrabold text-ink'}>
        {title}
      </h3>
    )}
    <div className={'bg-white border border-line rounded-xl shadow-panel p-4 pl-0'}>
      <ResponsiveContainer width={'100%'} height={340}>
        <LineChart data={data}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray={'4 4'} />
          <XAxis
            dataKey={'label'}
            tick={{ fontSize: 11, fontWeight: 600, fill: CHART.tick }}
            angle={-45}
            textAnchor={'end'}
            height={70}
          />
          <YAxis
            tick={{ fontSize: 11, fontWeight: 600, fill: CHART.tick }}
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type={'monotone'}
            dataKey={'revenue'}
            name={'Выручка по броням'}
            stroke={CHART.brand}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
)
