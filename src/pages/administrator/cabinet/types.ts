/* eslint-disable @typescript-eslint/no-explicit-any */
// Формы данных кабинета администратора. Вынесено из AdministratorCabinetPage
// в этапе 6 аудита — ПЕРЕНОС без изменений.

export interface ServiceProvided {
  id: number
  date: string
  staffSalaries: string | number
  salonSalaries: string | number
  tip: string | number
  clientName?: string
  offer?: {
    id: number
    title: string
  }
}

export interface MasterData {
  personalId: number
  name: string
  ratePercent: number
  excessThreshold: number
  servicesProvided: ServiceProvided[]
  penalties: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  payrolls: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  advances: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  extraProfits: Array<{
    id: number
    sum: number | string
    date: string
    title: string
  }>
  salaries: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
}

export interface AdministratorData {
  username: string
  role: string
  personal: {
    name: string
    position: string
    excessThreshold: number
    rates: any[]
    ratePercent: number
  }
  penalties: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  payrolls: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  workTimes: Array<{
    id: number
    date: string
    startTime: string
    endTime: string
    sum: number
    comment: string
  }>
  advances: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  salaries: Array<{
    id: number
    sum: number
    date: string
    comment: string
  }>
  extraProfits: Array<{
    id: number
    sum: number | string
    date: string
    title: string
  }>
  masterData: MasterData | null
}

export interface Payment {
  id: number
  sum: number | string
  date: string
  comment?: string
  title?: string
  type: 'advance' | 'salary' | 'bonus'
}
