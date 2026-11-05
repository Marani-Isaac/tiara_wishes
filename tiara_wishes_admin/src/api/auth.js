import { api, request, setAccessToken } from './client'

export async function login(email, password) {
  const body = await request(api.post('/auth/login', { email, password }))
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
