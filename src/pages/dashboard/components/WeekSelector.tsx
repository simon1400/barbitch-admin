import { useState } from 'react'

interface WeekSelectorProps {
  onWeekChange: (startDate: Date, endDate: Date) => void
  currentWeekRange: { firstDay: Date; lastDay: Date }
}

export const WeekSelector = ({ onWeekChange, currentWeekRange }: WeekSelectorProps) => {
  const [weekOffset, setWeekOffset] = useState(0)

  const getWeekDates = (offset: number) => {
    const today = new Date()
    const dayOfWeek = today.getDay()

    // Вычисляем разницу до понедельника
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    const year = today.getFullYear()
    const month = today.getMonth()
    const dayOfMonth = today.getDate()

    // Понедельник текущей недели + смещение (в UTC)
    const startDate = new Date(Date.UTC(year, month, dayOfMonth + diff + offset * 7, 0, 0, 0, 0))

    // Воскресенье (в UTC)
    const endDate = new Date(Date.UTC(year, month, dayOfMonth + diff + offset * 7 + 6, 23, 59, 59, 999))

    return { startDate, endDate }
  }

  const handlePreviousWeek = () => {
    const newOffset = weekOffset - 1
    setWeekOffset(newOffset)
    const { startDate, endDate } = getWeekDates(newOffset)
    onWeekChange(startDate, endDate)
  }

  const handleNextWeek = () => {
    const newOffset = weekOffset + 1
    setWeekOffset(newOffset)
    const { startDate, endDate } = getWeekDates(newOffset)
    onWeekChange(startDate, endDate)
  }

  return (
    <div className={'flex flex-col md:flex-row items-center gap-3'}>
      <div className={'flex items-center gap-2'}>
        <button
          onClick={handlePreviousWeek}
          className={
            'bg-white border border-accent text-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-4 py-2 rounded transition-colors'
          }
          aria-label={'Předchozí týden'}
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

        <div>
          <p className={'text-sm text-gray-500'}>
            {currentWeekRange.firstDay.toLocaleDateString('cs-CZ', { timeZone: 'UTC' })} -{' '}
            {currentWeekRange.lastDay.toLocaleDateString('cs-CZ', { timeZone: 'UTC' })}
          </p>
        </div>

        <button
          onClick={handleNextWeek}
          className={
            'bg-white border border-accent text-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-4 py-2 rounded transition-colors'
          }
          aria-label={'Následující týden'}
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
    </div>
  )
}
