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
    <div className={'bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md'}>
      <div className={'text-xs font-semibold text-blue-gray-900 mb-1'}>{label}</div>
      <div className={'text-xs font-medium text-primary'}>{fmtMoney(row.revenue)}</div>
      <div className={'text-xss text-gray-500'}>{row.visits} визитов</div>
    </div>
  )
}

export const RevenueBarChart = ({ data, title }: Props) => (
  <div className={'w-full'}>
    {title && (
      <h3 className={'text-sm11 md:text-sm1 font-semibold mb-4 text-primary opacity-80'}>
        {title}
      </h3>
    )}
    <div className={'bg-white p-4 pl-0 rounded-xl shadow-md'}>
      <ResponsiveContainer width={'100%'} height={340}>
        <LineChart data={data}>
          <CartesianGrid stroke={'#e0e0e0'} strokeDasharray={'3 3'} />
          <XAxis
            dataKey={'label'}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor={'end'}
            height={70}
          />
          <YAxis
            tick={{ fontSize: 12 }}
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
