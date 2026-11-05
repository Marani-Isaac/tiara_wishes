import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const TOKEN_KEY = 'tiara_customer_access'

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message || 'Request failed')
    this.name = 'ApiError'
    this.status = status || 0
    this.code = code || 'REQUEST_FAILED'
    this.details = details || {}
  }
}

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export const api = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  const csrf = readCookie('csrf_token')
  if (csrf) config.headers['X-CSRF-Token'] = csrf
  return config
})

function toApiError(error) {
  if (error instanceof ApiError) return error
  const status = error?.response?.status || 0
  const body = error?.response?.data
  const apiError = body?.error
  if (!error?.response) {
    return new ApiError({
      status: 0,
      code: 'NETWORK',
      message: 'The Tiara Wishes shop could not reach the store. Check that the API is running, then try again.',
    })
  }
  const fallback = {
    401: 'Sign in again to continue.',
    403: 'You do not have permission for this action.',
    404: 'That page or record was not found.',
    409: 'This change conflicts with the current record.',
    422: 'Check the form and try again.',
    429: 'Too many attempts. Wait a moment, then try again.',
  }
  if (status >= 500 && !apiError) {
    return new ApiError({
      status,
      code: 'SERVICE_UNAVAILABLE',
      message: 'The store is temporarily unavailable. Try again in a moment.',
    })
  }
  return new ApiError({
    status,
    code: apiError?.code || `HTTP_${status || 'ERROR'}`,
    message: apiError?.message || fallback[status] || 'The request failed.',
    details: apiError?.details || {},
  })
}

let refreshing = null

export function refreshAccessToken() {
  if (!refreshing) {
    refreshing = axios
      .post(
        `${baseURL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          timeout: 15000,
          headers: { 'X-CSRF-Token': readCookie('csrf_token') },
        },
      )
      .then((response) => {
        const token = response.data?.data?.access_token
        const user = response.data?.data?.user
        if (!token) {
          throw new ApiError({ status: 401, code: 'UNAUTHORIZED', message: 'Sign in again to continue.' })
        }
        setAccessToken(token)
        return { token, user }
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const original = error?.config
    const url = original?.url || ''
    const skip = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout') || url.includes('/auth/register')
    if (status === 401 && original && !original._retry && !skip && getAccessToken()) {
      original._retry = true
      try {
        const { token } = await refreshAccessToken()
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      } catch (refreshError) {
        setAccessToken(null)
        return Promise.reject(toApiError(refreshError))
      }
    }
    return Promise.reject(toApiError(error))
  },
)

export async function request(promise) {
  const response = await promise
  return response.data
}

export async function restoreSession() {
  return refreshAccessToken()
}
