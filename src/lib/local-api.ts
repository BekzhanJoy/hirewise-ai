const BACKEND_URL = typeof window !== 'undefined' ? 'http://localhost:8000' : 'http://localhost:8000'

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

