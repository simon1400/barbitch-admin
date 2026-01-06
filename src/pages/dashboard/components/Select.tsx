import { monthLabels } from '../data'

export const Select = ({
  month,
  setMonth,
  year,
  setYear,
}: {
  month: number
  setMonth: (month: number) => void
  year?: number
  setYear?: (year: number) => void
}) => {
  // Generate year options from 2024 to current year + 1
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i)

  return (
    <div className="flex gap-3">
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
      {year !== undefined && setYear && (
        <select
          id={'year-select'}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className={
            'bg-white border border-accent text-sm focus:ring-blue-500 focus:border-blue-500 block w-[120px] p-2.5'
          }
        >
          {years.map((y) => (
            <option value={y} key={y}>
              {y}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
