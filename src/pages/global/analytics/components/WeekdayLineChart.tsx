import {
  CartesianGrid,
  Legend,
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
    clientsPerDay: number
  }[]
  title?: string
}

const MAX_COLOR = '#16a34a' // самый загруженный день — зелёный
const MIN_COLOR = '#dc2626' // самый слабый день — красный
const BASE_COLOR = '#e71e6e' // линия и остальные точки — розовый

interface DotProps {
  cx?: number
  cy?: number
  payload?: { label: string; clientsPerDay: number }
}

export const WeekdayLineChart = ({ data, title }: Props) => {
  const values = data.map((d) => d.clientsPerDay)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const colorFor = (v: number) => (v === max ? MAX_COLOR : v === min ? MIN_COLOR : BASE_COLOR)

  const renderDot = (props: unknown) => {
    const { cx, cy, payload } = props as DotProps
    if (cx == null || cy == null || !payload) return <g key={'empty'} />
    const isExtreme = payload.clientsPerDay === max || payload.clientsPerDay === min
    return (
      <circle
        key={payload.label}
        cx={cx}
        cy={cy}
        r={isExtreme ? 6 : 4}
        fill={colorFor(payload.clientsPerDay)}
        stroke={'#fff'}
        strokeWidth={1.5}
      />
    )
  }

  return (
    <div className={'w-full'}>
      {title && (
        <h3 className={'text-sm11 md:text-sm1 font-semibold mb-4 text-primary opacity-80'}>
          {title}
        </h3>
      )}
      <div className={'bg-white p-4 pl-0 rounded-xl shadow-md'}>
        <ResponsiveContainer width={'100%'} height={320}>
          <LineChart data={data}>
            <CartesianGrid stroke={'#e0e0e0'} strokeDasharray={'3 3'} />
            <XAxis
              dataKey={'label'}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor={'end'}
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
            <Legend align={'center'} verticalAlign={'top'} wrapperStyle={{ paddingBottom: '10px' }} />
            <Line
              type={'monotone'}
              dataKey={'clientsPerDay'}
              name={'Визитов/день'}
              stroke={BASE_COLOR}
              strokeWidth={2}
              dot={renderDot}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
