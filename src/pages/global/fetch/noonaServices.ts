import { NoonaHQ, NoonaHQBase } from '../../../lib/noona'

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

let cachedVatId: string | null = null

type ApiError = { response?: { data?: { message?: string } }; message?: string }

const getErrorMessage = (err: unknown) => {
  const e = err as ApiError
  return e?.response?.data?.message ?? e?.message ?? 'Ошибка'
}

const getVatId = async (): Promise<string | null> => {
  if (cachedVatId !== null) return cachedVatId
  try {
    const res = await NoonaHQ.get(`/${COMPANY_ID}/vats`)
    const vats: { id?: string; percent?: number; rate?: number }[] = res.data
    if (!Array.isArray(vats) || vats.length === 0) return null
    const zeroVat = vats.find((v) => v.percent === 0 || v.rate === 0)
    cachedVatId = (zeroVat ?? vats[0])?.id ?? null
    return cachedVatId
  } catch {
    return null
  }
}

interface EventTypePref {
  event_type: string | { id?: string }
  has_custom_duration?: boolean
  skip_calendar?: boolean
}

const assignServiceToEmployee = async (empId: string, serviceId: string) => {
  const empRes = await NoonaHQ.get(`/${COMPANY_ID}/employees/${empId}`)
  const prefs: EventTypePref[] = empRes.data?.event_type_preferences ?? []
  const alreadyAssigned = prefs.some((p) => {
    const etId = typeof p.event_type === 'object' ? p.event_type?.id : p.event_type
    return etId === serviceId
  })
  if (alreadyAssigned) return
  await NoonaHQ.post(`/${COMPANY_ID}/employees/${empId}`, {
    event_type_preferences: [
      ...prefs,
      { event_type: serviceId, has_custom_duration: false, skip_calendar: false },
    ],
  })
}

const addServiceToGroup = async (categoryId: string, serviceId: string) => {
  const groupsRes = await NoonaHQ.get(
    `/${COMPANY_ID}/event_type_groups?expand[]=ordered_event_types.event_type`,
  )
  const groups: { id: string; ordered_event_types?: { event_type?: { id?: string } | string; id?: string }[] }[] =
    groupsRes.data ?? []
  const targetGroup = groups.find((g) => g.id === categoryId)
  const ordered = targetGroup?.ordered_event_types ?? []
  const currentIds = ordered.map((item) => {
    if (typeof item === 'string') return item
    const et = item.event_type
    return (typeof et === 'object' ? et?.id : et) ?? item.id ?? ''
  })
  await NoonaHQBase.post(`/event_type_groups/${categoryId}`, {
    event_types: [...currentIds, serviceId],
  })
}

export interface CreateServicePayload {
  title: string
  minutes: number
  price: number
  employeeIds: string[]
  categoryId?: string
}

export interface CreateServiceResult {
  id: string
  title: string
  status: 'ok' | 'error'
  error?: string
  warning?: string
}

export const createNoonaService = async (
  payload: CreateServicePayload,
): Promise<CreateServiceResult> => {
  try {
    const vatId = await getVatId()
    const body: Record<string, unknown> = {
      company: COMPANY_ID,
      title: payload.title,
      duration: payload.minutes,
      color: '#FF787D',
      variations: [{ prices: [{ amount: payload.price, currency: 'CZK' }] }],
      connections: { hidden: false, customer_selects: 'employee', service_needs: 'employee' },
    }
    if (vatId) body.vat = vatId

    const res = await NoonaHQBase.post(`/event_types`, body)
    const data = res.data
    const newId: string = data?.id ?? data?._id ?? '—'

    let warning: string | undefined

    if (newId !== '—' && payload.employeeIds.length > 0) {
      try {
        // When at least one employee has explicit prefs, Noona switches to whitelist mode
        await Promise.all(
          payload.employeeIds.map((empId) => assignServiceToEmployee(empId, newId).catch(() => {})),
        )
      } catch (err) {
        warning = `Мастера созданы, но фильтрация не удалась: ${getErrorMessage(err)}`
      }
    }

    if (payload.categoryId && newId !== '—') {
      await addServiceToGroup(payload.categoryId, newId).catch(() => {})
    }

    return { id: newId, title: payload.title, status: 'ok', warning }
  } catch (err) {
    return { id: '—', title: payload.title, status: 'error', error: getErrorMessage(err) }
  }
}
