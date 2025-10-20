import type { ReactNode } from 'react'

export const Container = ({
  children,
  size,
  className = '',
}: {
  children: ReactNode | ReactNode[]
  className?: string
  size: 'sm' | 'md' | 'lg' | 'xl'
}) => {
  const widths = {
    sm: `mx-auto w-full max-w-[600px] md:px-4 px-2 ${className}`,
    md: `mx-auto w-full max-w-[800px] md:px-4 px-2 ${className}`,
    lg: `mx-auto w-full max-w-[900px] md:px-4 px-2 ${className}`,
    xl: `mx-auto w-full max-w-[1440px] md:px-4 px-2 ${className}`,
  }

  return <div className={widths[size]}>{children}</div>
}
