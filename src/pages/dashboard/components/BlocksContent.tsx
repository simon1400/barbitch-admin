import type { ReactNode } from 'react'

import { BlockItem } from './BlockItem'

// Сетка плиток-показателей (новый стиль s165). Живёт внутри белой карточки-секции.
// `children` (s258) — свои плитки в той же сетке после обычных (плитка с переключением дня).

export const BlocksContent = ({
  title,
  items,
  children,
}: {
  title?: string
  items: { title: string; value: string | number; addValue?: string; tone?: 'accent' | 'neg' }[]
  children?: ReactNode
}) => {
  return (
    <>
      {title && (
        <h2 className={'m-0 mb-3.5 text-[15px] font-extrabold text-ink'}>{title}</h2>
      )}
      <div className={'grid grid-cols-2 md:grid-cols-3 gap-2.5'}>
        {items.map((item) => (
          <BlockItem
            key={item.title}
            title={item.title}
            content={`${item.value}`}
            addContent={item.addValue}
            tone={item.tone}
          />
        ))}
        {children}
      </div>
    </>
  )
}
