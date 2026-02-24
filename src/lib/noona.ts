import axios from 'axios'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addBearerToken = (config: any) => {
  const token = import.meta.env.VITE_NOONA_TOKEN
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

export const NoonaHQ = axios.create({
  baseURL: 'https://api.noona.is/v1/hq/companies',
})

NoonaHQ.interceptors.request.use(addBearerToken, (e) => Promise.reject(e))

export const NoonaHQBase = axios.create({
  baseURL: 'https://api.noona.is/v1/hq',
})

NoonaHQBase.interceptors.request.use(addBearerToken, (e) => Promise.reject(e))

export const NoonaMarketplace = axios.create({
  baseURL: 'https://api.noona.is/v1/marketplace',
})

NoonaMarketplace.interceptors.request.use(addBearerToken, (e) => Promise.reject(e))
