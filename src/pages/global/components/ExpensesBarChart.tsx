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
import { CHART, EXPENSE_COLORS } from '../../../ui/chartColors'

interface Props {
  data: {
    name: string
    sum: number
    noDph?: number
  }[]
  title?: string
}

const COLORS = EXPENSE_COLORS

export const ExpensesBarChart = ({ data, title }: Props) => {
  // Сортируем данные по сумме в убывающем порядке
  const sortedData = [...data].sort((a, b) => b.sum - a.sum)

  return (
    <div className={'w-full'}>
      {title && (
        <h3 className={'m-0 mb-3.5 text-[15px] font-extrabold text-ink'}>
          {title}
        </h3>
      )}
      <div className={'bg-white border border-line rounded-xl shadow-panel p-4 pl-0'}>
        <ResponsiveContainer width={'100%'} height={400}>
          <BarChart data={sortedData}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray={'4 4'} />
            <XAxis
              dataKey={'name'}
              tick={{ fontSize: 11, fontWeight: 600, fill: CHART.tick }}
              angle={-45}
              textAnchor={'end'}
              height={120}
            />
            <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: CHART.tick }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${CHART.border}`,
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
            <Bar dataKey={'noDph'} name={'Без DPH'} fill={CHART.mint} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
