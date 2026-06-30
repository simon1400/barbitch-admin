import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Props {
  data: {
    label: string
    revenue: number
    visits: number
  }[]
  title?: string
}

const fmtMoney = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`

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
            yAxisId={'left'}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          />
          <YAxis
            yAxisId={'right'}
            orientation={'right'}
            tick={{ fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #ddd',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) =>
              name === 'Выручка по броням' ? fmtMoney(value) : value
            }
          />
          <Line
            yAxisId={'left'}
            type={'monotone'}
            dataKey={'revenue'}
            name={'Выручка по броням'}
            stroke={'#e71e6e'}
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId={'right'}
            type={'monotone'}
            dataKey={'visits'}
            name={'Визитов'}
            stroke={'#161615'}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
)
