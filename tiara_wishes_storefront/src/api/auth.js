import { api, request, setAccessToken } from './client'

export async function login(email, password) {
  const body = await request(api.post('/auth/login', { email, password }))
  setAccessToken(body.data?.access_token || null)
  return body.data
}

export async function register(payload) {
  const body = await request(api.post('/auth/register', payload))
  setAccessToken(body.data?.access_token || null)
  return body.data
}

export async function logout() {
  try {
    await request(api.post('/auth/logout'))
  } finally {
    setAccessToken(null)
  }
}

export async function fetchMe() {
  const body = await request(api.get('/auth/me'))
  return body.data
}

export async function forgotPassword(email) {
  const body = await request(api.post('/auth/forgot-password', { email }))
  return body.message
}

export async function resetPassword(token, password) {
  const body = await request(api.post('/auth/reset-password', { token, password }))
  return body.message
}
