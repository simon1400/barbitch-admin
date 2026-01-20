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

  const handlePreviousMonth = () => {
    if (month === 0) {
      setMonth(11)
      if (year !== undefined && setYear && year > 2024) {
        setYear(year - 1)
      }
    } else {
      setMonth(month - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0)
      if (year !== undefined && setYear) {
        setYear(year + 1)
      }
    } else {
      setMonth(month + 1)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handlePreviousMonth}
        className={
          'bg-white border border-accent text-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-3 py-2.5 rounded transition-colors shrink-0'
        }
        aria-label={'Předchozí měsíc'}
      >
        <svg
          className={'w-4 h-4'}
          fill={'none'}
          stroke={'currentColor'}
          viewBox={'0 0 24 24'}
        >
          <path
            strokeLinecap={'round'}
            strokeLinejoin={'round'}
            strokeWidth={2}
            d={'M15 19l-7-7 7-7'}
          />
        </svg>
      </button>
      <select
        id={'month-select'}
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className={
          'bg-white border border-accent text-sm focus:ring-blue-500 focus:border-blue-500 block w-[120px] sm:w-[160px] p-2.5'
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
            'bg-white border border-accent text-sm focus:ring-blue-500 focus:border-blue-500 block w-[80px] sm:w-[100px] p-2.5'
          }
        >
          {years.map((y) => (
            <option value={y} key={y}>
              {y}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={handleNextMonth}
        className={
          'bg-white border border-accent text-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-3 py-2.5 rounded transition-colors shrink-0'
        }
        aria-label={'Následující měsíc'}
      >
        <svg
          className={'w-4 h-4'}
          fill={'none'}
          stroke={'currentColor'}
          viewBox={'0 0 24 24'}
        >
          <path
            strokeLinecap={'round'}
            strokeLinejoin={'round'}
            strokeWidth={2}
            d={'M9 5l7 7-7 7'}
          />
        </svg>
      </button>
    </div>
  )
}
