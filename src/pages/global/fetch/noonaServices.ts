import { NoonaHQ } from '../../../lib/noona'

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

export interface CreateServicePayload {
  title: string
  minutes: number
  price: number
  employeeIds: string[]
}

export interface CreateServiceResult {
  id: string
  title: string
  status: 'ok' | 'error'
  error?: string
}

export const createNoonaService = async (
  payload: CreateServicePayload,
): Promise<CreateServiceResult> => {
  try {
    const body: Record<string, unknown> = {
      title: payload.title,
      duration: payload.minutes,
      prices: [{ amount: payload.price }],
    }
    if (payload.employeeIds.length > 0) {
      body.employee_ids = payload.employeeIds
    }
    const res = await NoonaHQ.post(`/${COMPANY_ID}/event_types`, body)
    const data = res.data
    return {
      id: data?.id ?? data?._id ?? '—',
      title: payload.title,
      status: 'ok',
    }
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } }; message?: string }
    return {
      id: '—',
      title: payload.title,
      status: 'error',
      error: e?.response?.data?.message ?? e?.message ?? 'Ошибка',
    }
  }
}
