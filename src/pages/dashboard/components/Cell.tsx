import React from 'react'

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
      <th className={`p-4 border-b border-blue-gray-100 bg-blue-gray-50 ${className}`}>
        <p className={'block font-sans text-sm font-normal text-blue-gray-900 opacity-70'}>
          {title}
        </p>
      </th>
    ) : (
      <td className={`p-4 border-b border-blue-gray-50 ${onClick ? 'group' : ''}`} onClick={onClick}>
        <span className={`block font-sans text-sm font-medium text-blue-gray-900 ${className} ${onClick ? 'group-hover:text-primary' : ''}`}>{title}</span>
      </td>
    ),
)
