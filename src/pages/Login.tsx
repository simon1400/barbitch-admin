import { useNavigate } from 'react-router-dom'
import { useCallback, useState } from 'react'
import { Top } from '../components/Top'
import { loginUser } from '../services/auth'

const Login = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const login = useCallback(async () => {
    setError('')
    setIsLoading(true)

    try {
      const result = await loginUser(username, password)

      if ('error' in result) {
        setError(result.message || result.error || 'Неверное имя пользователя или пароль')
        setIsLoading(false)
        return
      }

      // Сохраняем данные пользователя
      localStorage.setItem('usernameLocalData', result.username)
      localStorage.setItem('userRole', result.role)
      localStorage.setItem('userId', result.id.toString())

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
      setError('Произошла ошибка при входе. Попробуйте снова.')
      setIsLoading(false)
    }
  }, [username, password, navigate])

  return (
    <>
      <Top title={'Login'} />
      <section className={' min-h-screen flex justify-center'}>
        <div className={'w-full max-w-md px-4'}>
          <div className={'bg-white rounded-2xl shadow-2xl p-8 border border-gray-100'}>
            {/* Header */}
            <div className={'text-center mb-8'}>
              <div
                className={
                  'w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4'
                }
              >
                <svg
                  className={'w-8 h-8 text-primary'}
                  fill={'none'}
                  stroke={'currentColor'}
                  viewBox={'0 0 24 24'}
                >
                  <path
                    strokeLinecap={'round'}
                    strokeLinejoin={'round'}
                    strokeWidth={2}
                    d={'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'}
                  />
                </svg>
              </div>
              <h2 className={'text-2xl font-bold text-gray-800 mb-2'}>{'Přihlášení do systému'}</h2>
              <p className={'text-sm text-gray-500'}>{'Zadejte své přihlašovací údaje'}</p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className={
                  'mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3'
                }
              >
                <svg
                  className={'w-5 h-5 text-red-500 flex-shrink-0 mt-0.5'}
                  fill={'currentColor'}
                  viewBox={'0 0 20 20'}
                >
                  <path
                    fillRule={'evenodd'}
                    d={
                      'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                    }
                    clipRule={'evenodd'}
                  />
                </svg>
                <span className={'text-sm text-red-800'}>{error}</span>
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                login()
              }}
              className={'space-y-5'}
            >
              <div>
                <label className={'block text-sm font-medium text-gray-700 mb-2'}>
                  {'Uživatelské jméno'}
                </label>
                <input
                  className={
                    'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none'
                  }
                  value={username}
                  placeholder={'Zadejte uživatelské jméno'}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError('')
                  }}
                  type={'text'}
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <label className={'block text-sm font-medium text-gray-700 mb-2'}>{'Heslo'}</label>
                <input
                  className={
                    'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none'
                  }
                  value={password}
                  placeholder={'Zadejte heslo'}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  type={'password'}
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type={'submit'}
                disabled={isLoading}
                className={
                  'w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                }
              >
                {isLoading ? (
                  <>
                    <svg
                      className={'animate-spin h-5 w-5 text-white'}
                      xmlns={'http://www.w3.org/2000/svg'}
                      fill={'none'}
                      viewBox={'0 0 24 24'}
                    >
                      <circle
                        className={'opacity-25'}
                        cx={'12'}
                        cy={'12'}
                        r={'10'}
                        stroke={'currentColor'}
                        strokeWidth={'4'}
                      />
                      <path
                        className={'opacity-75'}
                        fill={'currentColor'}
                        d={
                          'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                        }
                      />
                    </svg>
                    <span>{'Přihlašování...'}</span>
                  </>
                ) : (
                  'Přihlásit se'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className={'mt-6 text-center'}>
              <p className={'text-xs text-gray-500'}>
                {'Zabezpečené přihlášení pro zaměstnance a administraci'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default Login
