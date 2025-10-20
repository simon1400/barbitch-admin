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
      <h3 className={'text-sm11 md:text-sm1 font-semibold mb-4 text-primary opacity-80'}>
        {title}
      </h3>
    )}
    <div className={'bg-white p-4 pl-0 rounded-xl shadow-md'}>
      <ResponsiveContainer width={'100%'} height={300}>
        <LineChart data={data}>
          <CartesianGrid stroke={'#e0e0e0'} strokeDasharray={'3 3'} />
          <XAxis
            dataKey={'date'}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor={'end'}
            height={60}
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
