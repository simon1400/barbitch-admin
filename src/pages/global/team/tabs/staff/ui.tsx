import { useState, type ReactNode } from 'react'
import { btnNeutralCls, cardPadCls, cardTitleCls, labelCls } from '../../../../../ui/kit'
import type { StaffPhoto } from '../../fetch/staff'

// Общие кирпичи карточки сотрудника (s226).

/** Фото или инициалы. */
export function StaffAvatar({ name, photo, size }: { name: string; photo: StaffPhoto | null; size: number }) {
  const initials = name
    .replace(/❌/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
  const style = { width: size, height: size }
  if (photo?.thumb) {
    return <img src={photo.thumb} alt="" style={style} className="rounded-full object-cover shrink-0 bg-surface-input" />
  }
  return (
    <span
      style={{ ...style, fontSize: Math.round(size / 2.8) }}
      className="rounded-full shrink-0 bg-brand-tint text-brand-dark font-extrabold inline-flex items-center justify-center"
    >
      {initials || '?'}
    </span>
  )
}

/** Белая карточка-секция с заголовком и действием справа. */
export function SectionCard({
  title,
  action,
  children,
  testId,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  testId?: string
}) {
  return (
    <section className={cardPadCls} data-testid={testId}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className={cardTitleCls}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Строка «подпись — значение» в режиме просмотра. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={labelCls}>{label}</div>
      <div className="text-[14px] font-semibold text-ink-body break-words">{children}</div>
    </div>
  )
}

export function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div role="alert" className="mt-3 text-[12px] font-semibold text-neg">
      {text}
    </div>
  )
}

export function OkLine({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div role="status" className="mt-3 text-[12.5px] font-semibold text-pos">
      {text}
    </div>
  )
}

export const EditButton = ({ onClick, disabled, label = 'Изменить' }: { onClick: () => void; disabled?: boolean; label?: string }) => (
  <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={onClick} disabled={disabled}>
    {label}
  </button>
)

/**
 * Пароль, выданный сервером, — показывается ОДИН раз (в базе только хэш).
 * Копирование в один клик; после ухода со страницы его больше не увидеть.
 */
export function PasswordBox({ username, password, onClose }: { username: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard
      ?.writeText(password)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }
  return (
    <div role="status" data-testid="staff-password" className="mb-3.5 rounded-xl border border-warn-line bg-warn-bg px-5 py-4">
      <div className="text-[13px] font-extrabold text-warn">Пароль для входа — показывается один раз</div>
      <div className="mt-2 text-[13px] font-semibold text-ink-body">
        Логин: <b>{username}</b>
      </div>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        <code className="px-2.5 py-1 rounded-md bg-white border border-line text-[16px] font-bold tracking-wide text-ink select-all">
          {password}
        </code>
        <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={copy}>
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
        <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={onClose}>
          Я передал(а) пароль
        </button>
      </div>
      <div className="mt-2 text-[12px] font-medium text-ink-soft">
        Передайте пароль сотруднику лично. Если потеряется — сбросьте пароль в разделе «Учётка».
      </div>
    </div>
  )
}
