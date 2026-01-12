import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { CategorizedExpense } from '../utils/categorizeExpenses'

interface Props {
  data: CategorizedExpense[]
  title?: string
}

export const ExpensesCategoryChart = ({ data, title }: Props) => {
  const chartData = data as unknown as Record<string, unknown>[]

  const renderCustomLabel = (entry: any) => {
    const percent = ((entry.value / data.reduce((sum, item) => sum + item.sum, 0)) * 100).toFixed(1)
    return `${entry.name}: ${percent}%`
  }

  return (
    <div className={'w-full'}>
      {title && (
        <h3 className={'text-sm11 md:text-sm1 font-semibold mb-4 text-primary opacity-80'}>
          {title}
        </h3>
      )}
      <div className={'bg-white p-4 rounded-xl shadow-md'}>
        <ResponsiveContainer width={'100%'} height={400}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey={'sum'}
              nameKey={'category'}
              cx={'50%'}
              cy={'50%'}
              outerRadius={120}
              label={renderCustomLabel}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `${value.toLocaleString()} Kč`}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        {/* Таблица с деталями категорий */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Категория</th>
                <th className="px-4 py-2 text-right font-semibold">Кол-во</th>
                <th className="px-4 py-2 text-right font-semibold">Сумма</th>
                <th className="px-4 py-2 text-right font-semibold">Без DPH</th>
                <th className="px-4 py-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const totalSum = data.reduce((sum, d) => sum + d.sum, 0)
                const percent = ((item.sum / totalSum) * 100).toFixed(1)
                return (
                  <tr key={index} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium">{item.category}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.count}</td>
                    <td className="px-4 py-2 text-right font-semibold text-primary">
                      {item.sum.toLocaleString()} Kč
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {item.noDph.toLocaleString()} Kč
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{percent}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
