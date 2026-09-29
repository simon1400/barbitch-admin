import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  btnNeutralCls,
  btnPinkCls,
  cardTitleCls,
  formCardCls,
  hintCls,
  inputCls,
  labelCls,
  mutedCls,
} from '../../../../../ui/kit'
import { fmtCsDate, todayYmd } from '../../../../../utils/date'
import { isPayrollLockedName } from '../../../../dashboard/fetch/teamSplit'
import {
  POSITION_LABEL,
  PRIVATE_KEYS,
  PRIVATE_LABEL,
  cleanName,
  createStaff,
  monthStartOf,
  ymdToBirth,
  type CreateStaffInput,
  type Position,
  type PrivateValues,
  type StaffCard,
  type Tier,
  type TypeWork,
} from '../../fetch/staff'
import { ErrorLine, PasswordBox } from './ui'

const INT = /^\d+$/
const POSITIONS = Object.keys(POSITION_LABEL) as Position[]
const EMPTY_PRIVATE = Object.fromEntries(PRIVATE_KEYS.map((k) => [k, ''])) as PrivateValues

/** Договор по умолчанию: управляющая — оклад (HPP), администратор — почасовая (DPP). */
const defaultTypeWork = (p: Position | ''): TypeWork => (p === 'manager' ? 'hpp' : 'dpp')

// «Новый сотрудник» `/global/team/staff/new` (s226). Обязательны только имя и должность
// (решение владельца s222); остальное — по желанию, дозаполняется в карточке.
export default function NewStaffPage() {
  const today = todayYmd()
  const [name, setName] = useState('')
  const [position, setPosition] = useState<Position | ''>('')
  const [tier, setTier] = useState<Tier>('senior')
  const [hiredAt, setHiredAt] = useState(today)
  const [percent, setPercent] = useState('')
  const [typeWork, setTypeWork] = useState<TypeWork>('dpp')
  const [rate, setRate] = useState('')
  const [hourly, setHourly] = useState('')
  const [rateFrom, setRateFrom] = useState(today)
  const [withPrivate, setWithPrivate] = useState(false)
  const [priv, setPriv] = useState<PrivateValues>(EMPTY_PRIVATE)
  const [birthYmd, setBirthYmd] = useState('')
  const [account, setAccount] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<(StaffCard & { password: string | null }) | null>(null)

  const master = position === 'master'
  const clean = cleanName(name)
  const locked = clean !== '' && isPayrollLockedName(clean)
  const percentOk = !master || percent === '' || (INT.test(percent) && Number(percent) <= 100)
  const rateOk =
    master ||
    rate === '' ||
    (INT.test(rate) && Number(rate) > 0 && (hourly === '' || INT.test(hourly)) && rateFrom >= monthStartOf(today))
  const canSave = !saving && clean.length >= 2 && !!position && !locked && percentOk && rateOk

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave || !position) return
    setSaving(true)
    setError(null)
    const input: CreateStaffInput = { name: clean, position, hiredAt, account }
    if (master) {
      input.tier = tier
      if (percent !== '') input.ratePercent = Number(percent)
    } else if (rate !== '') {
      input.rate = {
        typeWork,
        rate: Number(rate),
        from: rateFrom,
        ...(typeWork === 'hpp' && hourly ? { hourlyRate: Number(hourly) } : {}),
      }
    }
    if (withPrivate) {
      const filled = { ...priv, dateBirth: ymdToBirth(birthYmd) }
      const data = Object.fromEntries(Object.entries(filled).filter(([, v]) => v.trim() !== ''))
      if (Object.keys(data).length) input.private = data
    }
    try {
      setCreated(await createStaff(input))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (created) return <Created card={created} />

  return (
    <>
      <Link to="/global/team/staff" className={`${mutedCls} hover:text-ink`}>
        ← Все сотрудники
      </Link>
      <form onSubmit={submit} className={`${formCardCls} mt-3 mb-3.5 max-w-[720px]`} data-testid="staff-new">
        <h2 className={`${cardTitleCls} mb-4`}>Новый сотрудник</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block">
            <span className={labelCls}>Имя и фамилия *</span>
            <input name="name" className={`${inputCls} w-full`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <span className={hintCls}>Это же имя станет логином входа.</span>
          </label>
          <label className="block">
            <span className={labelCls}>Должность *</span>
            <select
              name="position"
              className={`${inputCls} w-full`}
              value={position}
              onChange={(e) => {
                const p = e.target.value as Position
                setPosition(p)
                setTypeWork(defaultTypeWork(p))
              }}
            >
              <option value="">— выберите —</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POSITION_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          {master && (
            <label className="block">
              <span className={labelCls}>Уровень</span>
              <select name="tier" className={`${inputCls} w-full`} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
                <option value="senior">senior</option>
                <option value="junior">junior (−20 % на сайте)</option>
              </select>
            </label>
          )}
          <label className="block">
            <span className={labelCls}>Работает с</span>
            <input name="hiredAt" type="date" className={`${inputCls} w-full`} value={hiredAt} onChange={(e) => setHiredAt(e.target.value)} />
          </label>
        </div>
        {locked && <div className="mt-2 text-[12px] font-semibold text-neg">Это имя зашито в расчёт зарплат — выберите другое.</div>}

        {position && (
          <div className="mt-5">
            <div className={labelCls}>Оплата (необязательно)</div>
            {master ? (
              <label className="block max-w-[200px]">
                <span className={hintCls}>Доля мастера от услуг, %</span>
                <input name="ratePercent" type="number" min={0} max={100} className={`${inputCls} w-full`} value={percent} onChange={(e) => setPercent(e.target.value)} />
              </label>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="block">
                  <span className={hintCls}>Договор</span>
                  <select name="typeWork" className={`${inputCls} w-full`} value={typeWork} onChange={(e) => setTypeWork(e.target.value as TypeWork)}>
                    <option value="dpp">DPP — почасовая</option>
                    <option value="hpp">HPP — оклад</option>
                  </select>
                </label>
                <label className="block">
                  <span className={hintCls}>{typeWork === 'hpp' ? 'Оклад, Kč/мес' : 'Ставка, Kč/час'}</span>
                  <input name="rate" type="number" min={1} className={`${inputCls} w-full`} value={rate} onChange={(e) => setRate(e.target.value)} />
                </label>
                {typeWork === 'hpp' && (
                  <label className="block">
                    <span className={hintCls}>+ Kč/час</span>
                    <input name="hourlyRate" type="number" min={1} className={`${inputCls} w-full`} value={hourly} onChange={(e) => setHourly(e.target.value)} />
                  </label>
                )}
                <label className="block">
                  <span className={hintCls}>С даты</span>
                  <input
                    name="rateFrom"
                    type="date"
                    min={monthStartOf(today)}
                    className={`${inputCls} w-full`}
                    value={rateFrom}
                    onChange={(e) => setRateFrom(e.target.value)}
                  />
                </label>
              </div>
            )}
            {!rateOk && <div className="mt-1 text-[12px] font-semibold text-neg">Ставка — целое число; дата — не раньше {fmtCsDate(monthStartOf(today))}.</div>}
            {!percentOk && <div className="mt-1 text-[12px] font-semibold text-neg">Доля — целое число от 0 до 100.</div>}
          </div>
        )}

        <div className="mt-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={withPrivate} onChange={(e) => setWithPrivate(e.target.checked)} />
            <span className="text-[13px] font-semibold text-ink-body">Заполнить личные данные сейчас (можно позже в карточке)</span>
          </label>
          {withPrivate && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="staff-new-private">
              {PRIVATE_KEYS.map((k) =>
                k === 'dateBirth' ? (
                  <label key={k} className="block">
                    <span className={hintCls}>{PRIVATE_LABEL[k]}</span>
                    <input name={k} type="date" className={`${inputCls} w-full`} value={birthYmd} onChange={(e) => setBirthYmd(e.target.value)} />
                  </label>
                ) : (
                  <label key={k} className={`block ${k.startsWith('address') ? 'sm:col-span-2' : ''}`}>
                    <span className={hintCls}>{PRIVATE_LABEL[k]}</span>
                    <input
                      name={k}
                      className={`${inputCls} w-full`}
                      value={priv[k]}
                      maxLength={200}
                      onChange={(e) => setPriv((p) => ({ ...p, [k]: e.target.value }))}
                    />
                  </label>
                ),
              )}
            </div>
          )}
        </div>

        <label className="mt-5 flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={account} onChange={(e) => setAccount(e.target.checked)} />
          <span className="text-[13px] font-semibold text-ink-body">
            Создать учётку админки (логин = имя, роль — по должности, пароль покажется один раз)
          </span>
        </label>

        <ErrorLine text={error} />
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button type="submit" className={btnPinkCls} disabled={!canSave}>
            {saving ? 'Создаю…' : 'Создать сотрудника'}
          </button>
          <Link to="/global/team/staff" className={btnNeutralCls}>
            Отмена
          </Link>
          {master && <span className={hintCls}>Мастер появится в календаре сразу, на сайте — после назначения услуг.</span>}
        </div>
      </form>
    </>
  )
}

// Экран после создания: пароль (один раз) и чек-лист «Что осталось».
function Created({ card }: { card: StaffCard & { password: string | null } }) {
  const [password, setPassword] = useState(card.password)
  const master = card.position === 'master'
  const cardUrl = `/global/team/staff/${encodeURIComponent(card.documentId)}`
  const steps: { text: string; to: string; link: string }[] = [
    ...(master
      ? [
          { text: 'Назначить услуги — без них мастер не появится на сайте', to: '/global/catalog', link: 'Каталог' },
          { text: 'Завести шаблон недели — без него мастер открыт весь день', to: `/schedule?master=${encodeURIComponent(card.documentId)}`, link: 'График' },
        ]
      : []),
    { text: 'Загрузить фото', to: cardUrl, link: 'Карточка' },
    { text: 'Добавить документы и личные данные', to: cardUrl, link: 'Карточка' },
  ]
  return (
    <div data-testid="staff-created">
      {password && card.account && (
        <PasswordBox username={card.account.username} password={password} onClose={() => setPassword(null)} />
      )}
      <div className={`${formCardCls} max-w-[720px]`}>
        <h2 className={`${cardTitleCls} mb-1`}>Сотрудник создан: {card.name}</h2>
        <div className={mutedCls}>
          {POSITION_LABEL[card.position as Position] ?? ''}
          {card.account ? ` · учётка «${card.account.username}»` : ' · без учётки'}
        </div>
        <div className={`${labelCls} mt-4`}>Что осталось</div>
        <ol className="m-0 pl-[20px] grid gap-1.5">
          {steps.map((s) => (
            <li key={s.text} className="text-[13.5px] font-medium text-ink-body">
              {s.text} —{' '}
              <Link to={s.to} className="font-semibold text-brand-dark underline">
                {s.link}
              </Link>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex gap-2 flex-wrap">
          <Link to={cardUrl} className={btnPinkCls}>
            Открыть карточку
          </Link>
          <Link to="/global/team/staff" className={btnNeutralCls}>
            К списку
          </Link>
        </div>
        {password && <div className={`mt-3 ${hintCls}`}>Скопируйте пароль до перехода — позже его не увидеть (только сбросить).</div>}
      </div>
    </div>
  )
}
