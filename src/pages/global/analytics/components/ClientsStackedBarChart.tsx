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
      <h3 className={'text-sm11 md:text-sm1 font-semibold mb-4 text-primary opacity-80'}>
        {title}
      </h3>
    )}
    <div className={'bg-white p-4 pl-0 rounded-xl shadow-md'}>
      <ResponsiveContainer width={'100%'} height={340}>
        <BarChart data={data}>
          <CartesianGrid stroke={'#e0e0e0'} strokeDasharray={'3 3'} />
          <XAxis
            dataKey={'label'}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor={'end'}
            height={70}
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
          <Bar
            dataKey={'newClients'}
            stackId={'clients'}
            name={'Новые'}
            fill={'#e71e6e'}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey={'returning'}
            stackId={'clients'}
            name={'Повторные'}
            fill={'#16a34a'}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
)
