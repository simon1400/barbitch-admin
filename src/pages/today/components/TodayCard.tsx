// Карточка дашборда «Сегодня»: заголовок + счётчик + состояние + список + ссылка.
// Состояния: загрузка, ошибка источника (только эта карточка), «всё в порядке»
// (зелёная точка) и «требует внимания» (янтарный счётчик).
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cardCls, cardTitleCls, hintCls } from '../../../ui/kit'

interface Props {
  id: string
  title: string
  /** сколько пунктов требует внимания; null — карточка информационная (без счётчика) */
  count: number | null
  loading: boolean
  error?: string | null
  okText?: string
  link?: { to: string; label: string }
  children?: ReactNode
}

export function TodayCard({ id, title, count, loading, error, okText, link, children }: Props) {
  const attention = !loading && !error && count != null && count > 0
  const ok = !loading && !error && count === 0
  return (
    <section
      data-card={id}
      data-count={loading || error ? undefined : (count ?? undefined)}
      data-state={loading ? 'loading' : error ? 'error' : attention ? 'attention' : ok ? 'ok' : 'info'}
      className={`${cardCls} px-5 py-4 flex flex-col gap-2.5 min-w-0 ${attention ? '!border-warn-line' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            error ? 'bg-neg' : attention ? 'bg-warn' : ok ? 'bg-pos' : 'bg-ink-faint'
          }`}
        />
        <h2 className={`${cardTitleCls} flex-1 min-w-0`}>{title}</h2>
        {attention && (
          <span className="text-[12px] font-extrabold rounded-full px-2.5 py-0.5 bg-warn-bg text-warn">{count}</span>
        )}
      </div>
      {loading ? (
        <div className={hintCls}>Загрузка…</div>
      ) : error ? (
        <div className="text-[12.5px] font-semibold text-neg">Не удалось загрузить: {error}</div>
      ) : ok ? (
        <div className="text-[12.5px] font-semibold text-pos">{okText || 'Всё в порядке'}</div>
      ) : (
        children
      )}
      {link && !loading && (
        <Link to={link.to} className="mt-auto self-start text-[12.5px] font-bold text-brand-dark hover:underline">
          {link.label} →
        </Link>
      )}
    </section>
  )
}

/** Строка списка внутри карточки: основная часть слева, приписка справа. */
export function TodayRow({ to, children, aside }: { to?: string; children: ReactNode; aside?: ReactNode }) {
  const body = (
    <>
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink-body break-words">{children}</span>
      {aside && <span className="shrink-0 text-right">{aside}</span>}
    </>
  )
  const cls = 'flex items-start gap-3 py-1.5 border-t border-line-soft first:border-t-0'
  return to ? (
    <Link to={to} className={`${cls} hover:bg-surface-hover rounded-md -mx-1.5 px-1.5 no-underline`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
