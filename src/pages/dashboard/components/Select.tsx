import { monthLabels } from '../data'

export const Select = ({
  month,
  setMonth,
}: {
  month: number
  setMonth: (month: number) => void
}) => {
  return (
    <select
      id={'month-select'}
      value={month}
      onChange={(e) => setMonth(Number(e.target.value))}
      className={
        'bg-white border border-accent text-sm focus:ring-blue-500 focus:border-blue-500 block w-[200px] p-2.5'
      }
    >
      {monthLabels.map((label, idx) => (
        <option value={idx} key={label}>
          {label}
        </option>
      ))}
    </select>
  )
}
