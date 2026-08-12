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
  data: any
  lines: {
    dataKey: string
    stroke: string
    name: string
    strokeWidth?: number
  }[]
  title?: string
}

export const GlobalLineChart = ({ data, lines, title }: Props) => (
  <div className={'w-full'}>
    {title && (
      <h3 className={'m-0 mb-3.5 text-[15px] font-extrabold text-ink'}>
        {title}
      </h3>
    )}
    <div className={'bg-white border border-line rounded-xl shadow-panel p-4 pl-0'}>
      <ResponsiveContainer width={'100%'} height={300}>
        <LineChart data={data}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray={'4 4'} />
          <XAxis
            dataKey={'date'}
            tick={{ fontSize: 11, fontWeight: 600, fill: CHART.tick }}
            angle={-45}
            textAnchor={'end'}
            height={60}
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
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type={'monotone'}
              {...line}
              strokeWidth={line.strokeWidth ?? 2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
)
