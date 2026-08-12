import { useNavigate } from 'react-router-dom'
import { useCallback, useState } from 'react'
import { loginUser } from '../services/auth'
import { LogoIcon } from '../icons/Logo'
import { CHART } from '../ui/chartColors'
import { inputBaseCls, labelCls } from '../ui/kit'

// Редизайн страницы логина по макету «Логин — редизайн» (Claude Design, s167):
// розовая полоска 3px сверху → по центру бренд-блок (лого + кикер) → белая карточка
// с формой. Прежний розовый hero (компонент Top) удалён — он жил только здесь.
//
// ⚠️ Цвета — только токены палитры (src/ui/palette.js), размеры — literal px
// (кастомная шкала fontSize админки здесь не используется) — как в src/ui/kit.ts.

const cardCls =
  'bg-white border border-line rounded-[14px] shadow-panel-lg box-border px-[26px] py-7'

const loginInputCls = `${inputBaseCls} w-full rounded-[9px] px-[13px] py-[11px] text-[15px] disabled:opacity-55 disabled:pointer-events-none`

const Login = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [shake, setShake] = useState<boolean>(false)

  const fail = useCallback((message: string) => {
    setError(message)
    setIsLoading(false)
    setShake(true)
  }, [])

  const login = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      fail('Vyplňte uživatelské jméno a heslo')
      return
    }

    setError('')
    setShake(false)
    setIsLoading(true)

    try {
      const result = await loginUser(username, password)

      if ('error' in result) {
        fail(result.message || result.error || 'Neplatné uživatelské jméno nebo heslo')
        return
      }

      // Сохраняем данные пользователя
      localStorage.setItem('usernameLocalData', result.username)
      localStorage.setItem('userRole', result.role)
      localStorage.setItem('userId', result.id.toString())
      localStorage.setItem('userJwt', result.jwt)

      // Перенаправляем в зависимости от роли
      if (result.role === 'owner') {
        navigate('/global')
      } else if (result.role === 'administrator') {
        navigate('/administrator-cabinet')
      } else {
        navigate('/')
      }
    } catch (err) {
      console.error('Login error:', err)
      fail('Při přihlášení došlo k chybě. Zkuste to prosím znovu.')
    }
  }, [username, password, navigate, fail])

  return (
    <main className={'min-h-screen flex flex-col box-border'}>
      <div className={'h-[3px] flex-none bg-gradient-to-r from-brand to-brand-grad-to'} />

      <div className={'flex-1 flex items-center justify-center box-border px-4 py-8'}>
        <div className={'w-full max-w-[400px]'}>
          {/* Бренд */}
          <div className={'text-center mb-[22px]'}>
            <LogoIcon className={'h-[22px] w-auto mx-auto fill-ink'} dotFill={CHART.brand} />
            <div
              className={
                'text-[10.5px] font-bold tracking-[0.14em] uppercase text-ink-faint mt-[3px]'
              }
            >
              {'admin panel'}
            </div>
          </div>

          {/* Карточка формы */}
          <div
            className={`${cardCls}${shake ? ' animate-shake' : ''}`}
            onAnimationEnd={(e) => {
              // animationend всплывает — гасим тряску только от самой карточки,
              // иначе появление плашки ошибки (fade-up) сбросит её раньше времени.
              if (e.target === e.currentTarget) setShake(false)
            }}
          >
            <h1 className={'m-0 mb-1 text-[19px] font-extrabold text-ink text-center'}>
              {'Přihlášení do systému'}
            </h1>
            <p className={'m-0 mb-[22px] text-[12.5px] font-semibold text-ink-faint text-center'}>
              {'Zadejte své přihlašovací údaje'}
            </p>

            {error && (
              <div
                className={
                  'flex items-start gap-2.5 bg-neg-bg border border-neg-line rounded-[10px] px-3 py-[11px] mb-4 animate-fade-up'
                }
                role={'alert'}
              >
                <span
                  className={
                    'w-[17px] h-[17px] mt-px flex-none rounded-full bg-neg text-white text-[10px] font-extrabold inline-flex items-center justify-center'
                  }
                  aria-hidden={'true'}
                >
                  {'!'}
                </span>
                <span className={'text-[12.5px] leading-[1.5] font-semibold text-neg'}>
                  {error}
                </span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                login()
              }}
              noValidate
            >
              <div className={'mb-3.5'}>
                <label className={labelCls} htmlFor={'login-username'}>
                  {'Uživatelské jméno'}
                </label>
                <input
                  id={'login-username'}
                  className={loginInputCls}
                  value={username}
                  placeholder={'Zadejte uživatelské jméno'}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError('')
                  }}
                  type={'text'}
                  autoComplete={'username'}
                  disabled={isLoading}
                />
              </div>

              <div className={'mb-5'}>
                <label className={labelCls} htmlFor={'login-password'}>
                  {'Heslo'}
                </label>
                <div className={'relative'}>
                  <input
                    id={'login-password'}
                    className={`${loginInputCls} pr-[76px]`}
                    value={password}
                    placeholder={'Zadejte heslo'}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={'current-password'}
                    disabled={isLoading}
                  />
                  <button
                    type={'button'}
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className={
                      'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[7px] px-2 py-1.5 text-[11px] font-bold text-ink-faint transition-colors hover:text-brand hover:bg-brand-wash-soft'
                    }
                  >
                    {showPassword ? 'skrýt' : 'zobrazit'}
                  </button>
                </div>
              </div>

              <button
                type={'submit'}
                disabled={isLoading}
                className={
                  'box-border w-full flex items-center justify-center gap-[9px] rounded-[9px] border-0 bg-brand py-3 text-[14.5px] font-extrabold text-white shadow-brand-lg transition-colors hover:bg-brand-hover disabled:opacity-75 disabled:pointer-events-none'
                }
              >
                {isLoading && (
                  <span
                    className={
                      'w-[15px] h-[15px] rounded-full border-2 border-white/35 border-t-white animate-spin'
                    }
                    aria-hidden={'true'}
                  />
                )}
                {isLoading ? 'Přihlašování...' : 'Přihlásit se'}
              </button>
            </form>

            <p
              className={
                'm-0 mt-4.5 text-[11px] leading-[1.5] font-semibold text-ink-label text-center'
              }
            >
              {'Zabezpečené přihlášení pro zaměstnance a administraci'}
            </p>
          </div>

          <div className={'text-center mt-4.5'}>
            <span className={'text-[11px] font-semibold text-ink-label'}>
              {`© ${new Date().getFullYear()} Barbitch · Brno`}
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}

export default Login
