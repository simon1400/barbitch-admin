import { useState } from 'react'

interface StatSectionProps {
  title: string
  id: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export const StatSection = ({ title, id, children, defaultOpen = true }: StatSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section id={id} className={'mb-6 scroll-mt-20'}>
      <div
        className={
          'flex justify-between items-center mb-4 cursor-pointer hover:opacity-80 transition-opacity'
        }
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className={'text-sm1 md:text-md font-semibold text-gray-700'}>{title}</h2>
        <button
          type={'button'}
          className={'text-md text-primary hover:scale-110 transition-transform'}
          aria-label={isOpen ? 'Свернуть' : 'Развернуть'}
        >
          {isOpen ? '−' : '+'}
        </button>
      </div>
      {isOpen && <div className={'animate-fadeIn'}>{children}</div>}
    </section>
  )
}
