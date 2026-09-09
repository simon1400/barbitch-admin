// Карточка одного сотрудника. Перенесено из TaxesTab.tsx (этап 6) дословно.
import { chipCls, labelCls, selectCls } from '../../../../../ui/kit'
import { kc } from '../../../../../utils/money'
import type {
  ContractType,
  EmployeeTaxResult,
  PersonalOption,
} from '../../fetch/czechTax'
import type { Row } from './model'
import { fieldCls } from './styles'
import { NumField } from './Fields'
import { OdvodyBox, ResultGrid } from './ResultBoxes'

// Кружок-галка внутри чипа-тогла
const chipCheckCls = (on: boolean): string =>
  'inline-flex items-center justify-center w-[15px] h-[15px] rounded-full text-[9px] shrink-0 ' +
  (on ? 'bg-brand text-white' : 'bg-surface-track text-surface-track')

const CONTRACT_LABEL: Record<ContractType, string> = {
  hpp: 'HPP',
  dpp: 'DPP',
  osvc: 'OSVČ',
}

export function EmployeeCard({
  row,
  res,
  people,
  onPatch,
  onRemove,
}: {
  row: Row
  res: EmployeeTaxResult
  people: PersonalOption[]
  onPatch: (p: Partial<Row>) => void
  onRemove: () => void
}) {
  const isOsvc = row.contract === 'osvc'

  return (
    <div className="border border-line-soft rounded-[10px] p-4 mb-3">
      {/* Шапка: имя + тип смлувы + удалить */}
      <div className="grid grid-cols-[minmax(200px,1fr)_130px_34px] gap-2.5 items-end mb-3">
        <label className="block min-w-0">
          <span className={labelCls}>Сотрудник</span>
          <input
            list="tax-personals"
            value={row.name}
            onChange={(e) => {
              const name = e.target.value
              const p = people.find((x) => x.name === name)
              onPatch(p ? { name, contract: p.typeWork === 'dpp' ? 'dpp' : 'hpp' } : { name })
            }}
            placeholder="Jméno"
            className={fieldCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Smlouva</span>
          <select
            value={row.contract}
            onChange={(e) => onPatch({ contract: e.target.value as ContractType })}
            className={`${selectCls} w-full`}
          >
            {(['hpp', 'dpp', 'osvc'] as ContractType[]).map((c) => (
              <option key={c} value={c}>
                {CONTRACT_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={onRemove}
          className="w-[34px] h-[38px] rounded-lg border-0 bg-transparent text-[15px] text-ink-icon transition-colors hover:bg-brand-wash hover:text-brand-alert"
          title="Smazat zaměstnance"
        >
          ✕
        </button>
      </div>

      {/* Ввод: čistá + дни отсутствия */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <NumField
          label={isOsvc ? 'Fakturováno' : 'Čistá (na ruku)'}
          value={row.net}
          onChange={(net) => onPatch({ net })}
          placeholder="0"
          suffix="Kč"
        />
        <NumField
          label="Nemoc"
          value={row.sickDays}
          onChange={(sickDays) => onPatch({ sickDays })}
          suffix="dní"
        />
        <NumField
          label="Dovolená pl."
          value={row.vacationPaidDays}
          onChange={(vacationPaidDays) => onPatch({ vacationPaidDays })}
          suffix="dní"
        />
        <NumField
          label="Neplac. volno"
          value={row.vacationUnpaidDays}
          onChange={(vacationUnpaidDays) => onPatch({ vacationUnpaidDays })}
          suffix="dní"
        />
      </div>

      {/* Чипы-модификаторы расчёта */}
      <div className="mt-3 flex gap-2 flex-wrap">
        {isOsvc ? (
          <span className="text-[12px] font-semibold text-ink-faint">
            faktura — salon neodvádí nic
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onPatch({ prohlaseni: !row.prohlaseni })}
              className={chipCls(row.prohlaseni)}
            >
              <span className={chipCheckCls(row.prohlaseni)}>✓</span>
              podepsané prohlášení (sleva)
            </button>
            {row.contract === 'hpp' && (
              <button
                type="button"
                onClick={() => onPatch({ healthMinimum: !row.healthMinimum })}
                className={chipCls(row.healthMinimum)}
              >
                <span className={chipCheckCls(row.healthMinimum)}>✓</span>
                doplatek ZP do minima
              </button>
            )}
            {row.contract === 'dpp' && (
              <button
                type="button"
                onClick={() => onPatch({ dppAboveLimit: !row.dppAboveLimit })}
                className={chipCls(row.dppAboveLimit)}
              >
                <span className={chipCheckCls(row.dppAboveLimit)}>✓</span>
                nad limitem (s odvody)
              </button>
            )}
          </>
        )}
      </div>

      <div className="my-3 border-t border-line-soft" />

      {/* Результат расчёта */}
      <ResultGrid
        gross={res.gross}
        health={res.healthTotal}
        social={res.socialTotal}
        tax={res.tax}
        cost={res.totalCost}
      />

      <OdvodyBox res={res} />

      {(res.warnings.length > 0 || res.sickCompensation > 0 || res.healthDoplatek > 0) && (
        <div className="mt-3 space-y-1.5">
          {(res.sickCompensation > 0 || res.healthDoplatek > 0 || res.taxWithheld) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-ink-soft">
              {res.sickCompensation > 0 && (
                <span>
                  Náhrada za nemoc <b className="text-ink-body">{kc(res.sickCompensation)}</b>{' '}
                  (bez odvodů)
                </span>
              )}
              {res.healthDoplatek > 0 && (
                <span>
                  z toho doplatek ZP <b className="text-ink-body">{kc(res.healthDoplatek)}</b>
                </span>
              )}
              {res.taxWithheld && <span>srážková daň 15 %</span>}
            </div>
          )}
          {res.warnings.map((w) => (
            <div
              key={w}
              className="rounded-lg bg-warn-bg text-warn text-[12px] font-semibold px-3 py-2"
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
