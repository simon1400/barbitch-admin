import axios from 'axios'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337'

export const Axios = axios.create({
  baseURL: apiUrl,
})

Axios.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    return Promise.reject(error)
  },
)
