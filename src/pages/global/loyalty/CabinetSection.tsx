// Цифровые аккаунты кабинета. Перенесено из LoyaltyPage.tsx (этап 6) дословно.
import { useMemo, useState } from 'react'
import { Pagination } from '../../../components/Pagination'
import { Cell } from '../../dashboard/components/Cell'
import { TableWrapper } from '../components/TableWrapper'
import type { CabinetAccount } from '../fetch/loyalty'
import { fmtDate, PAGE_SIZE } from './format'

// ── цифровые аккаунты кабинета ──

export function CabinetSection({ accounts }: { accounts: CabinetAccount[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const loggedIn = useMemo(() => accounts.filter((a) => a.cabinetLastLoginAt).length, [accounts])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.phone || '').includes(q),
    )
  }, [accounts, query])

  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  return (
    <div className={'mb-6'}>
      <div className={'flex flex-wrap items-center justify-between gap-2 mb-3'}>
        <h3 className={'text-2xl font-bold'}>Цифровые аккаунты кабинета</h3>
        <div className={'flex flex-wrap items-center gap-2'}>
          <span className={'px-3 py-1.5 rounded-lg bg-white shadow-sm text-sm'}>
            Зарегистрировано: <b>{accounts.length}</b>
          </span>
          <span className={'px-3 py-1.5 rounded-lg bg-white shadow-sm text-sm'}>
            Заходили: <b>{loggedIn}</b>
          </span>
          <input
            className={'border border-line-btn rounded-lg px-3 py-2 text-sm w-56'}
            placeholder={'Поиск: имя / e-mail / телефон'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className={'text-sm text-ink-soft'}>
          Пока никто не завёл цифровой аккаунт (не подтвердил e-mail в кабинете).
        </p>
      ) : (
        <TableWrapper additionalInfo={`Показано ${filtered.length} из ${accounts.length}`}>
          <table className={'w-full text-left min-w-[620px]'}>
            <thead>
              <tr>
                <Cell title={'Клиент'} asHeader />
                <Cell title={'E-mail'} asHeader />
                <Cell title={'Телефон'} asHeader />
                <Cell title={'Зарегистрирован'} asHeader />
                <Cell title={'Последний вход'} asHeader />
                <Cell title={'Реклама'} asHeader />
              </tr>
            </thead>
            <tbody>
              {paged.map((a) => (
                <tr key={a.documentId} className={'hover:bg-surface-hover'}>
                  <Cell title={a.name} className={'text-brand'} />
                  <Cell title={a.email || '—'} className={'text-ink-muted'} />
                  <Cell title={a.phone || '—'} className={'text-ink-muted'} />
                  <Cell title={fmtDate(a.emailVerifiedAt)} />
                  <td className={'p-4 border-b border-line-soft'}>
                    {a.cabinetLastLoginAt ? (
                      <span className={'text-emerald-700'}>{fmtDate(a.cabinetLastLoginAt)}</span>
                    ) : (
                      <span className={'text-ink-faint'}>ещё не входил</span>
                    )}
                  </td>
                  <Cell
                    title={a.marketingConsent ? '✓' : '—'}
                    className={a.marketingConsent ? 'text-emerald-600 font-bold' : 'text-ink-faint'}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      )}
      <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} unit={'операций'} />
      <p className={'mt-3 text-xs text-ink-soft'}>
        «Зарегистрирован» = клиент подтвердил e-mail и завёл цифровой аккаунт. «Последний вход» пуст,
        если аккаунт создан, но в кабинет пока не заходили.
      </p>
    </div>
  )
}
