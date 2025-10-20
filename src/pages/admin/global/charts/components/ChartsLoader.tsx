import { useEffect, useState } from 'react'

export const ChartsLoader = () => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 10
      })
    }, 150)

    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className={'fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm'}
    >
      <div className={'w-full max-w-md px-4'}>
        <div className={'text-center mb-6'}>
          <div
            className={
              'inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4'
            }
          />
          <h3 className={'text-md font-semibold text-gray-700 mb-2'}>{'Загрузка графиков...'}</h3>
          <p className={'text-sm text-gray-500'}>{'Подготовка данных для отображения'}</p>
        </div>

        <div className={'w-full bg-gray-200 rounded-full h-2 overflow-hidden'}>
          <div
            className={'h-full bg-primary transition-all duration-300 ease-out'}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className={'text-center mt-3'}>
          <span className={'text-sm font-medium text-gray-600'}>
            {progress}
            {'%'}
          </span>
        </div>
      </div>
    </div>
  )
}
