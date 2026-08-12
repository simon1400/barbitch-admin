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
      <h3 className={'m-0 mb-3.5 text-[15px] font-extrabold text-[#161615]'}>
        {title}
      </h3>
    )}
    <div className={'bg-white border border-[#eee9e6] rounded-xl shadow-[0_1px_2px_rgba(22,22,21,0.04)] p-4 pl-0'}>
      <ResponsiveContainer width={'100%'} height={300}>
        <LineChart data={data}>
          <CartesianGrid stroke={'#f2efec'} strokeDasharray={'4 4'} />
          <XAxis
            dataKey={'date'}
            tick={{ fontSize: 11, fontWeight: 600, fill: '#a39e99' }}
            angle={-45}
            textAnchor={'end'}
            height={60}
          />
          <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: '#a39e99' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #eee9e6',
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
