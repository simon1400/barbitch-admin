import axios from 'axios'

const addBearerToken = (config: Parameters<Parameters<typeof axios.interceptors.request.use>[0]>[0]) => {
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

export const NoonaMarketplace = axios.create({
  baseURL: 'https://api.noona.is/v1/marketplace',
})

NoonaMarketplace.interceptors.request.use(addBearerToken, (e) => Promise.reject(e))
