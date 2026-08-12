import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART } from '../../../../ui/chartColors'

interface Props {
  data: {
    label: string
    newClients: number
    returning: number
  }[]
  title?: string
}

export const ClientsStackedBarChart = ({ data, title }: Props) => (
  <div className={'w-full'}>
    {title && (
      <h3 className={'m-0 mb-3.5 text-[15px] font-extrabold text-ink'}>
        {title}
      </h3>
    )}
    <div className={'bg-white border border-line rounded-xl shadow-panel p-4 pl-0'}>
      <ResponsiveContainer width={'100%'} height={340}>
        <BarChart data={data}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray={'4 4'} />
          <XAxis
            dataKey={'label'}
            tick={{ fontSize: 11, fontWeight: 600, fill: CHART.tick }}
            angle={-45}
            textAnchor={'end'}
            height={70}
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
          <Bar
            dataKey={'newClients'}
            stackId={'clients'}
            name={'Новые'}
            fill={CHART.brand}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey={'returning'}
            stackId={'clients'}
            name={'Повторные'}
            fill={CHART.positive}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
)
