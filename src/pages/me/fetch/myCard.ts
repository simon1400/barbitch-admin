// «Мои данные» (фаза 2 карточки сотрудника): своя карточка — только чтение.
//
// 🟥 Данные — ТОЛЬКО ручка движка `/engine/admin/my-card`: сервер сам находит карточку
// сессии (по связи учётки, без связи — по имени), id в запросе нет вовсе — чужую не
// запросить. Личные данные — под ключом `private` (admin-session вырезает `oficial`).
// Сканы документов не скачиваются (только руководству): приходят тип, название и срок.
import { makeApiFetch } from '../../../lib/apiFetch'
import type { DocKind, Position, PrivateValues, StaffContract, StaffPhoto, Tier, TypeWork } from '../../global/team/fetch/staff'

export interface MyDocument {
  kind: DocKind
  title: string
  validUntil: string | null
  state: 'none' | 'ok' | 'soon' | 'expired'
  daysLeft: number | null
}

export interface MyCard {
  today: string
  name: string
  position: Position | null
  tier: Tier
  hiredAt: string | null
  photo: StaffPhoto | null
  private: PrivateValues
  documents: MyDocument[]
  contracts: { list: Omit<StaffContract, 'id'>[]; current: Omit<StaffContract, 'id'> | null }
  /** мастеру — доля; остальным — текущая ставка */
  pay: {
    ratePercent: number | null
    currentRate: { typeWork: TypeWork; rate: number | null; hourlyRate: number | null; from: string | null } | null
  }
}

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Сессия истекла — войдите снова.',
  // no_card — без подмены: сервер говорит, к кому обратиться
}

const meFetch = makeApiFetch('/api/engine/admin', CODE_MESSAGES, (s) => `Ошибка ${s}`)

export const fetchMyCard = () => meFetch<MyCard>('GET', '/my-card')
