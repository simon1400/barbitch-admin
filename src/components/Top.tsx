import { Container } from './Container'
import { LogoutButton } from './LogoutButton'
import LogoWrap from './LogoWrap'
import { Link, useLocation } from 'react-router-dom'
import { GlobalNav } from '../pages/global/components/GlobalNav'

export const Top = ({
  title,
  admin = false,
}: {
  title: string
  admin?: boolean
}) => {
  const location = useLocation()
  const userRole = localStorage.getItem('userRole')
  const isGlobalPage = location.pathname.startsWith('/global') ||
                       location.pathname === '/voucher-confirmation' ||
                       location.pathname === '/email-campaign'

  return (
    <section
      aria-labelledby={'top-title'}
      className={`h-[545px] mix-blend-multiply flex flex-col relative z-10 mb-13.5 bg-gradient-to-t from-[rgba(231,30,110,1)] to-[rgba(255,0,101,0.5)]`}
    >
      <div className="w-full">
        <Container size={'xl'}>
          <div className="flex justify-between items-center py-6">
            <LogoWrap />
            {admin && userRole === 'administrator' && (
              <nav className="flex gap-4">
                <Link
                  to="/administrator-cabinet"
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    location.pathname === '/administrator-cabinet'
                      ? 'bg-white text-primary'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Můj kabinet
                </Link>
              </nav>
            )}
          </div>
        </Container>
      </div>

      <div className="flex-1 flex items-end">
        <Container size={'xl'}>
          <div className={`pb-10 md:pb-15 ${!isGlobalPage || userRole !== 'owner' ? 'max-w-[650px]' : 'w-full'}`}>
            <h1
              id={'top-title'}
              className={`text-md2 lg:text-top pb-4 uppercase font-bold`}
            >
              {title}
            </h1>

            {admin && <LogoutButton />}

            {admin && isGlobalPage && userRole === 'owner' && <GlobalNav />}
          </div>
        </Container>
      </div>
    </section>
  )
}
