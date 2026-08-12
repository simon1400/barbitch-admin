import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface Props {
  data: {
    name: string
    sum: number
    noDph?: number
  }[]
  title?: string
}

const COLORS = [
  '#e71e6e',
  '#ff6b9d',
  '#c41e3a',
  '#ff1744',
  '#d81b60',
  '#e91e63',
  '#f06292',
  '#ec407a',
  '#ad1457',
  '#880e4f',
]

export const ExpensesBarChart = ({ data, title }: Props) => {
  // Сортируем данные по сумме в убывающем порядке
  const sortedData = [...data].sort((a, b) => b.sum - a.sum)

  return (
    <div className={'w-full'}>
      {title && (
        <h3 className={'m-0 mb-3.5 text-[15px] font-extrabold text-[#161615]'}>
          {title}
        </h3>
      )}
      <div className={'bg-white border border-[#eee9e6] rounded-xl shadow-[0_1px_2px_rgba(22,22,21,0.04)] p-4 pl-0'}>
        <ResponsiveContainer width={'100%'} height={400}>
          <BarChart data={sortedData}>
            <CartesianGrid stroke={'#f2efec'} strokeDasharray={'4 4'} />
            <XAxis
              dataKey={'name'}
              tick={{ fontSize: 11, fontWeight: 600, fill: '#a39e99' }}
              angle={-45}
              textAnchor={'end'}
              height={120}
            />
            <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: '#a39e99' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #eee9e6',
                borderRadius: '10px',
              fontSize: '12px',
              }}
              formatter={(value: number) => `${value.toLocaleString()} Kč`}
            />
            <Legend align={'center'} verticalAlign={'top'} wrapperStyle={{ paddingBottom: '10px' }} />
            <Bar dataKey={'sum'} name={'Сумма'} radius={[8, 8, 0, 0]}>
              {sortedData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
            <Bar dataKey={'noDph'} name={'Без DPH'} fill={'#82ca9d'} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
