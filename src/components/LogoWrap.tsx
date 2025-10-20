import { LogoIcon } from '../icons/Logo'

const LogoWrap = () => {
  return (
    <div>
      <a
        href={'/'}
        className={'block max-w-[205px] lg:max-w-[290px]'}
        aria-label={'Перейти на главную страницу'}
      >
        <LogoIcon className={`w-full`} />
      </a>
    </div>
  )
}

export default LogoWrap
