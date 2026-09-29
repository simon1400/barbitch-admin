import { useState } from 'react'
import { badgeNegCls, badgePosCls, btnDangerCls, btnNeutralCls, btnPinkCls, hintCls } from '../../../../../ui/kit'
import { ROLE_LABEL, staffAccountAction, type AccountAction, type StaffCard } from '../../fetch/staff'
import { ErrorLine, Field, OkLine, SectionCard } from './ui'

const CONFIRM: Partial<Record<AccountAction, (name: string) => string>> = {
  disable: (n) => `Отключить вход для «${n}»? Текущая сессия сотрудника перестанет работать сразу.`,
  reset_password: (n) => `Сбросить пароль «${n}»? Старый пароль перестанет подходить; новый покажется один раз.`,
}

const DONE: Record<AccountAction, string> = {
  create: 'Учётка создана.',
  disable: 'Вход отключён — сессия сотрудника погашена.',
  enable: 'Вход включён.',
  reset_password: 'Пароль сброшен.',
}

// Учётка админки: логин = имя карточки, роль следует за должностью (отдельного
// переключателя нет). Пароль генерирует сервер и отдаёт ОДИН раз — его показывает страница.
export function AccountSection({
  card,
  onCard,
  onPassword,
}: {
  card: StaffCard
  onCard: (c: StaffCard) => void
  onPassword: (username: string, password: string) => void
}) {
  const [busy, setBusy] = useState<AccountAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const a = card.account
  const owner = a?.role === 'owner'

  const run = async (action: AccountAction) => {
    const ask = CONFIRM[action]
    if (ask && !window.confirm(ask(card.name))) return
    setBusy(action)
    setError(null)
    setOk(null)
    try {
      const res = await staffAccountAction(card.documentId, action)
      onCard(res)
      if (res.password) onPassword(res.account?.username ?? card.name, res.password)
      setOk(res.unchanged ? 'Без изменений.' : DONE[action])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const btn = (action: AccountAction, label: string, cls = btnNeutralCls, disabled = false, title?: string) => (
    <button type="button" className={cls} disabled={!!busy || disabled} title={title} onClick={() => run(action)}>
      {busy === action ? '…' : label}
    </button>
  )

  return (
    <SectionCard title="Учётка админки" testId="staff-account">
      {!a ? (
        <>
          <div className="text-[13px] font-semibold text-ink-soft">Учётки нет — сотрудник не может войти в админку.</div>
          {!card.left && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              {btn('create', 'Создать учётку', btnPinkCls, !card.position)}
              <span className={hintCls}>Логин = имя «{card.name}», роль — по должности, пароль покажется один раз.</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Field label="Логин">{a.username}</Field>
            <Field label="Роль">{ROLE_LABEL[a.role] ?? a.role}</Field>
            <Field label="Вход">
              {a.isActive ? <span className={badgePosCls}>включён</span> : <span className={badgeNegCls}>отключён</span>}
            </Field>
          </div>
          {a.linked === false && (
            <div className={`mt-3 ${hintCls}`}>
              Учётка найдена по совпадению логина с именем — связь с карточкой не проставлена.
            </div>
          )}
          {owner ? (
            <div className={`mt-3 ${hintCls}`}>Учётка владельца из карточки не меняется.</div>
          ) : (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {a.isActive
                ? btn('disable', 'Отключить вход', btnDangerCls, card.self, card.self ? 'Свою учётку отключить нельзя' : undefined)
                : !card.left && btn('enable', 'Включить вход')}
              {!card.left && btn('reset_password', 'Сбросить пароль')}
              {card.self && <span className={hintCls}>Свою учётку отключить нельзя.</span>}
            </div>
          )}
        </>
      )}
      <OkLine text={ok} />
      <ErrorLine text={error} />
    </SectionCard>
  )
}
