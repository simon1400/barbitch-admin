import { Container } from './Container'
import { LogoutButton } from './LogoutButton'
import LogoWrap from './LogoWrap'

export const Top = ({
  title,
  admin = false,
}: {
  title: string
  admin?: boolean
}) => {
  return (
    <section
      aria-labelledby={'top-title'}
      className={`h-[545px] mix-blend-multiply flex flex-col relative z-10 mb-13.5 bg-gradient-to-t from-[rgba(231,30,110,1)] to-[rgba(255,0,101,0.5)]`}
    >
      <div className="w-full">
        <Container size={'xl'}>
          <div className="flex justify-between items-center py-6">
            <LogoWrap />
          </div>
        </Container>
      </div>

      <div className="flex-1 flex items-end">
        <Container size={'xl'}>
          <div className={`pb-10 md:pb-15 max-w-[650px]`}>
            <h1
              id={'top-title'}
              className={`text-md2 lg:text-top pb-4 uppercase font-bold`}
            >
              {title}
            </h1>

            {admin && <LogoutButton />}
          </div>
        </Container>
      </div>
    </section>
  )
}
