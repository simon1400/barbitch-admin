import React from 'react'

// Ячейка таблиц админки в новом стиле (s165): заголовки — uppercase 10.5px ink-label,
// данные — 13.5px/600 ink-body. className прокидывается для выравнивания/акцентов.

export const Cell = React.memo(
  ({
    title,
    asHeader,
    className = '',
    onClick,
  }: {
    title: string
    asHeader?: boolean
    className?: string
    onClick?: () => void
  }) =>
    asHeader ? (
      <th className={`px-3 py-[7px] text-left border-b border-line ${className}`}>
        <p
          className={
            'block text-[10.5px] font-bold tracking-[0.06em] uppercase text-ink-label whitespace-nowrap'
          }
        >
          {title}
        </p>
      </th>
    ) : (
      <td
        className={`px-3 py-[10px] border-b border-line-soft ${onClick ? 'group cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <span
          className={`block text-[13.5px] font-semibold text-ink-body ${className} ${onClick ? 'group-hover:text-brand' : ''}`}
        >
          {title}
        </span>
      </td>
    ),
)
