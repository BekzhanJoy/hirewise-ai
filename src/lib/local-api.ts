const rawBackendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
  (typeof window !== 'undefined' ? window.location.origin : '')

export const BACKEND_URL = rawBackendUrl.replace(/\/$/, '')

export function withBackendUrl(path: string): string {
  if (!path) return BACKEND_URL || '/'
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return BACKEND_URL ? `${BACKEND_URL}${normalized}` : normalized
}

export async function apiGet<T>(url: string): Promise<T> {
  const target = BACKEND_URL ? `${BACKEND_URL}${url}` : url
  const response = await fetch(target, {
    credentials: 'include',
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export async function apiSend<T>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const target = BACKEND_URL ? `${BACKEND_URL}${url}` : url
  const response = await fetch(target, {
    method,
    credentials: 'include',
    headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data as T
}
