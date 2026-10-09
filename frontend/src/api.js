export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('examslot_token')
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`${API_URL}${path}`, { ...options, headers })
}
