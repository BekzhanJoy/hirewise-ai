const DEFAULT_BACKEND_URL = 'http://localhost:8000'
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (typeof window !== 'undefined' ? DEFAULT_BACKEND_URL : DEFAULT_BACKEND_URL)

export function withBackendUrl(path: string): string {
  if (!path) return BACKEND_URL
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${BACKEND_URL}${normalized}`
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${url}`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export async function apiSend<T>(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${url}`, {
    method,
    headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

