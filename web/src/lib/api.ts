const BASE: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'

const ACCESS = 'tb.access'
const REFRESH = 'tb.refresh'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage can be blocked (private windows); the session then lasts until reload.
  }
}

export const tokens = {
  get access() {
    return read(ACCESS)
  },
  get refresh() {
    return read(REFRESH)
  },
  save(access: string, refresh: string) {
    write(ACCESS, access)
    write(REFRESH, refresh)
  },
  clear() {
    write(ACCESS, null)
    write(REFRESH, null)
  },
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Human-readable message for any failure. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof TypeError) return "Can't reach the TechBreak server"
  return 'Something went wrong'
}

let onSessionExpired: (() => void) | null = null
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn
}

let refreshing: Promise<boolean> | null = null

async function refreshTokens(): Promise<boolean> {
  const refresh = tokens.refresh
  if (!refresh) return false
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      })
      if (!res.ok) throw new Error('refresh rejected')
      const data = (await res.json()) as { accessToken: string; refreshToken: string }
      tokens.save(data.accessToken, data.refreshToken)
      return true
    } catch {
      tokens.clear()
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

type Query = Record<string, string | number | undefined>

async function request<T>(method: string, path: string, body?: unknown, query?: Query, retried = false): Promise<T> {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v))
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const access = tokens.access
  if (access) headers.Authorization = `Bearer ${access}`

  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  if (res.status === 401 && !retried && !path.startsWith('/auth/') && tokens.refresh) {
    if (await refreshTokens()) return request<T>(method, path, body, query, true)
    onSessionExpired?.()
  }
  const data: unknown = res.status === 204 ? {} : await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? String((data as { error: unknown }).error) : 'Something went wrong'
    throw new ApiError(res.status, message)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
}
