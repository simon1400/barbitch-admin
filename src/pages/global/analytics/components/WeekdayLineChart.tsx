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
import { CHART } from '../../../../ui/chartColors'

interface Props {
  data: {
    label: string
    clientsPerDay: number
  }[]
  title?: string
}

const MAX_COLOR = CHART.positive // самый загруженный день — зелёный
const MIN_COLOR = CHART.negative // самый слабый день — красный
const BASE_COLOR = CHART.brand // линия и остальные точки — розовый

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
        stroke={CHART.surface}
        strokeWidth={1.5}
      />
    )
  }

  return (
    <div className={'w-full'}>
      {title && (
        <h3 className={'m-0 mb-3.5 text-[15px] font-extrabold text-ink'}>
          {title}
        </h3>
      )}
      <div className={'bg-white border border-line rounded-xl shadow-panel p-4 pl-0'}>
        <ResponsiveContainer width={'100%'} height={320}>
          <LineChart data={data}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray={'4 4'} />
            <XAxis
              dataKey={'label'}
              tick={{ fontSize: 11, fontWeight: 600, fill: CHART.tick }}
              angle={-45}
              textAnchor={'end'}
              height={80}
            />
            <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: CHART.tick }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${CHART.border}`,
                borderRadius: '10px',
              fontSize: '12px',
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
