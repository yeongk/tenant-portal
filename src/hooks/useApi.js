import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
export function useApi() {
  const { idToken, logout } = useAuth()
  const req = useCallback(async (method, path, body) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (res.status === 401) { logout(); throw new Error('Session expired') }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`)
    return data
  }, [idToken, logout])
  return {
    get:   useCallback((p)    => req('GET',    p),    [req]),
    post:  useCallback((p, b) => req('POST',   p, b), [req]),
    put:   useCallback((p, b) => req('PUT',    p, b), [req]),
    patch: useCallback((p, b) => req('PATCH',  p, b), [req]),
    del:   useCallback((p)    => req('DELETE', p),    [req]),
  }
}
