import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const TOKEN_KEY = 'tiara_admin_access'

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
  const parts = document.cookie ? document.cookie.split('; ') : []
  const prefix = `${name}=`
  const match = parts.find((part) => part.startsWith(prefix))
  return match ? decodeURIComponent(match.slice(prefix.length)) : ''
}

export function csrfHeaders() {
  const csrf = readCookie('csrf_token')
  return csrf ? { 'X-CSRF-Token': csrf } : {}
}

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const method = (config.method || 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method)) {
    Object.assign(config.headers, csrfHeaders())
  }
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
      message: 'The Tiara Wishes API could not be reached. Start the Flask app, then try again.',
    })
  }
  const fallback = {
    401: 'Sign in again to continue.',
    403: 'You do not have permission for this action.',
    404: 'That record was not found.',
    409: 'This change conflicts with the current record.',
    422: 'Check the form and try again.',
    429: 'Too many attempts. Wait a moment, then try again.',
  }
  if (status >= 500 && !apiError) {
    return new ApiError({
      status,
      code: 'SERVICE_UNAVAILABLE',
      message: 'The Tiara Wishes API could not be reached. Start the Flask app, then try again.',
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

function refreshAccessToken() {
  if (!refreshing) {
    refreshing = axios
      .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true, headers: csrfHeaders() })
      .then((response) => {
        const token = response.data?.data?.access_token
        if (!token) {
          throw new ApiError({ status: 401, code: 'UNAUTHORIZED', message: 'Sign in again to continue.' })
        }
        setAccessToken(token)
        return token
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
    const skip =
      url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout')
    if (status === 401 && original && !original._retry && !skip) {
      original._retry = true
      try {
        const token = await refreshAccessToken()
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      } catch (refreshError) {
        setAccessToken(null)
        if (!window.location.pathname.startsWith('/admin/login')) {
          const next = `${window.location.pathname}${window.location.search}`
          window.location.assign(`/admin/login?next=${encodeURIComponent(next)}`)
        }
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
  const token = await refreshAccessToken()
  return token
}
