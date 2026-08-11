import { Container } from './Container'
import { LogoutButton } from './LogoutButton'
import LogoWrap from './LogoWrap'
import { GlobalNav } from '../pages/global/components/GlobalNav'
import Button from './Button'

export const Top = ({
  title,
  admin = false,
}: {
  title: string
  admin?: boolean
}) => {
  const userRole = localStorage.getItem('userRole')
  // owner и administrator ходят по модулям через меню GlobalNav (реестр src/moduleAccess.ts);
  // у мастера меню нет — только кнопка «Kalendář»
  const hasNav = admin && (userRole === 'owner' || userRole === 'administrator')

  return (
    <section
      aria-labelledby={'top-title'}
      className={`min-h-[545px] mix-blend-multiply flex flex-col relative z-10 mb-13.5 bg-gradient-to-t from-[rgba(231,30,110,1)] to-[rgba(255,0,101,0.5)]`}
    >
      <div className="w-full">
        <Container size={'xl'}>
          <div className="flex justify-between items-center py-6">
            <LogoWrap />
            <div className="flex items-center gap-4">
              {/* Мастер: свой read-only календарь по кнопке (меню у него нет) */}
              {admin && userRole === 'master' && (
                <Button text={'Kalendář'} id={'calendar-button'} to={'/calendar'} small />
              )}
              {admin && <LogoutButton />}
            </div>
          </div>
        </Container>
      </div>

      <div className="flex-1 flex items-end">
        <Container size={'xl'}>
          <div className={`pb-10 md:pb-15 ${hasNav ? 'w-full' : 'max-w-[650px]'}`}>
            <h1
              id={'top-title'}
              className={`text-md2 lg:text-top pb-4 uppercase font-bold`}
            >
              {title}
            </h1>

            {hasNav && <GlobalNav />}
          </div>
        </Container>
      </div>
    </section>
  )
}
