import { Link } from 'react-router-dom'

interface ButtonProps {
  text: string
  to?: string
  href?: string
  inverse?: boolean
  white?: boolean
  small?: boolean
  blank?: boolean
  className?: string
  id?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void
  loading?: boolean
}

const Button = ({
  text,
  to,
  href,
  inverse = false,
  white = false,
  small = false,
  blank = false,
  className = '',
  id = '',
  onClick,
  loading,
}: ButtonProps) => {
  const baseClasses = `inline-block border-0 uppercase text-nowrap duration-200 text-center`
  const textClasses = white && !inverse ? 'text-accent' : 'text-white'
  const cursorClasses = loading ? 'cursor-wait' : 'cursor-pointer'
  const sizeClasses = small
    ? 'py-3.5 px-6.5 lg:py-3 lg:px-5 text-resXs'
    : 'py-3.5 px-6.5 lg:py-4.5 lg:px-11.5 text-xs h-[48px] min-w-[139px] md:h-[57px] md:min-w-[177px]'
  const colorClasses = inverse
    ? 'bg-primary hover:text-accent'
    : white
      ? 'bg-white text-accent hover:text-primary'
      : 'bg-accent hover:text-primary'
  const combinedClasses = `${baseClasses} ${sizeClasses} ${colorClasses} ${className} ${textClasses} ${cursorClasses}`

  if (to) {
    return (
      <Link
        to={to}
        className={combinedClasses}
        id={id}
        onClick={onClick}
      >
        {!loading && text}
        {loading && (
          <span className={'flex items-center justify-center h-full'}>
            <svg className={'animate-spin h-5 w-5'} viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}
      </Link>
    )
  }

  return (
    <a
      href={href}
      target={blank ? '_blank' : '_self'}
      className={combinedClasses}
      id={id}
      onClick={onClick}
      rel={blank ? 'noopener noreferrer' : undefined}
    >
      {!loading && text}
      {loading && (
        <span className={'flex items-center justify-center h-full'}>
          <svg className={'animate-spin h-5 w-5'} viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </span>
      )}
    </a>
  )
}

export default Button
