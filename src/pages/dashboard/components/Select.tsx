import { iconBtnCls, selectCls } from '../../../ui/kit'
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
          iconBtnCls
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
          `${selectCls} block w-[120px] sm:w-[150px]`
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
            `${selectCls} block w-[80px] sm:w-[92px]`
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
          iconBtnCls
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
