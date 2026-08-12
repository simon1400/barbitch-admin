import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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
    <div className={'bg-white border border-[#eee9e6] rounded-[10px] px-3 py-2 shadow-[0_10px_28px_rgba(22,22,21,0.14)]'}>
      <div className={'text-[12px] font-extrabold text-[#161615] mb-1'}>{label}</div>
      <div className={'text-[12px] font-bold text-[#e71e6e]'}>{fmtMoney(row.revenue)}</div>
      <div className={'text-[11px] font-semibold text-[#8b857f]'}>{row.visits} визитов</div>
    </div>
  )
}

export const RevenueBarChart = ({ data, title }: Props) => (
  <div className={'w-full'}>
    {title && (
      <h3 className={'m-0 mb-3.5 text-[15px] font-extrabold text-[#161615]'}>
        {title}
      </h3>
    )}
    <div className={'bg-white border border-[#eee9e6] rounded-xl shadow-[0_1px_2px_rgba(22,22,21,0.04)] p-4 pl-0'}>
      <ResponsiveContainer width={'100%'} height={340}>
        <LineChart data={data}>
          <CartesianGrid stroke={'#f2efec'} strokeDasharray={'4 4'} />
          <XAxis
            dataKey={'label'}
            tick={{ fontSize: 11, fontWeight: 600, fill: '#a39e99' }}
            angle={-45}
            textAnchor={'end'}
            height={70}
          />
          <YAxis
            tick={{ fontSize: 11, fontWeight: 600, fill: '#a39e99' }}
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type={'monotone'}
            dataKey={'revenue'}
            name={'Выручка по броням'}
            stroke={'#e71e6e'}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
)
