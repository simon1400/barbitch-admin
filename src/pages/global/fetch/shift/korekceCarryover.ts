/* eslint-disable @typescript-eslint/no-explicit-any */
// Перенос доли при бесплатной коррекции (s210) и дельта закрытия смены.
//
// Движок сразу правит ОПУБЛИКОВАННУЮ исходную запись (Яна 20.09: 432/1008 → 0/864),
// а запись коррекции (Злата 23.09: 576/0) — черновик до закрытия смены D2. Поэтому
// «до смены» месячные итоги уже содержат половину переноса: разница месяца
// завышена на staffIn (596 вместо 20), результат — на staffOut. Без поправки
// «Rozdíl proti minulé směně» показывал −576, хотя месяц после закрытия сходится.
//
// Поправка возвращает «до» в состояние БЕЗ переносов, которые подтверждает эта
// смена: тогда разница смены = 0, а чистая прибыль смены = реальная цена коррекции
// для салона (−144 в прод-случае). Считаются только переносы record, уже
// применённые к опубликованной исходной записи (исходный визит в другой, закрытый
// день). Исходный визит в тот же день или ещё черновик — в «до» его нет, поправки нет.
import { Axios } from '../../../../lib/api'
import { authCfg } from './drafts'

const toNum = (v: unknown): number => {
  const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

export interface KorekceCarryover {
  result: number
  difference: number
}

export const korekceCarryover = async (dayItems: any[]): Promise<KorekceCarryover> => {
  const out: KorekceCarryover = { result: 0, difference: 0 }
  for (const it of dayItems || []) {
    const k = it?.korekce
    if (k?.mode !== 'record' || k.pending || !k.originalSpDocId) continue
    let pub: any = null
    try {
      pub = await Axios.get(
        `/api/services-provided/${k.originalSpDocId}?status=published&fields[0]=date`,
        authCfg(),
      )
    } catch {
      pub = null
    }
    if (!pub || (Array.isArray(pub) && !pub.length)) continue
    const staffOut = toNum(k.staffOutKc)
    const salonAdj = toNum(k.salonAdjKc)
    // исходная запись уже «потеряла» staffOut − salonAdj (= staffIn) в globalFlow
    // и staffOut в зарплатах мастеров — возвращаем «до» к состоянию без переноса
    out.difference -= staffOut - salonAdj
    out.result -= staffOut
  }
  return out
}
