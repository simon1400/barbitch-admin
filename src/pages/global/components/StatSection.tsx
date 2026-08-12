import { useState } from 'react'

import { cardCls, countBadgeCls } from '../../../ui/kit'

// Сворачиваемая секция = белая карточка нового стиля (s165). Заголовок 15px/800,
// клик по шапке сворачивает/разворачивает. Опц. count — розовый бейдж-счётчик у заголовка.

interface StatSectionProps {
  title: string
  id: string
  children: React.ReactNode
  defaultOpen?: boolean
  count?: number
}

export const StatSection = ({
  title,
  id,
  children,
  defaultOpen = true,
  count,
}: StatSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section id={id} className={`${cardCls} px-6 pt-[18px] pb-5 mb-3.5 scroll-mt-24`}>
      <div
        className={'flex justify-between items-center cursor-pointer select-none'}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className={'m-0 flex items-center gap-2 text-[15px] font-extrabold text-[#161615]'}>
          {title}
          {count !== undefined && <span className={countBadgeCls}>{count}</span>}
        </h2>
        <button
          type={'button'}
          className={
            'w-7 h-7 rounded-[7px] border-0 bg-transparent text-[15px] font-bold text-[#a39e99] transition-colors hover:bg-[#f6f4f2] hover:text-[#161615]'
          }
          aria-label={isOpen ? 'Свернуть' : 'Развернуть'}
        >
          {isOpen ? '−' : '+'}
        </button>
      </div>
      {isOpen && <div className={'pt-3.5'}>{children}</div>}
    </section>
  )
}
