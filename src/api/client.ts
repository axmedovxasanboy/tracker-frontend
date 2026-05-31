import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { saveToCache, getFromCache } from './cache'
import { tokenStore } from './tokens'

export const BASE_URL = '/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

// Add `_silent: true` to any axios call (e.g. `.post(url, body, { _silent: true })`)
// to suppress the global error toast for that single request — useful when the component
// already renders the error inline. `_retry` is set internally after a 401 token refresh.
declare module 'axios' {
  export interface AxiosRequestConfig {
    _silent?: boolean
    _retry?: boolean
  }
}

// Attach the access token to every request.
apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Public auth endpoints must NOT trigger the refresh-on-401 loop. (/auth/me is protected
// and SHOULD refresh, so it's intentionally excluded from this list.)
const NO_REFRESH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/status']

// Single in-flight refresh shared by all concurrent 401s.
let refreshPromise: Promise<string> | null = null
function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    const rt = tokenStore.getRefresh()
    if (!rt) return Promise.reject(new Error('No refresh token'))
    // Bare axios (no interceptors) so a failing refresh doesn't recurse.
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, { refreshToken: rt }, { headers: { 'Content-Type': 'application/json' } })
      .then((res) => {
        const data = res.data as { accessToken: string; refreshToken: string }
        tokenStore.set(data.accessToken, data.refreshToken)
        return data.accessToken
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// Callback set by AuthContext — fires when refresh fails and the session is gone.
export let onAuthLost: (() => void) | null = null
export const setAuthLostCallback = (cb: () => void) => { onAuthLost = cb }

interface BackendErrorPayload {
  message?: string
  error?: string
  errors?: Record<string, string>
}

export function extractErrorMessage(err: unknown): string {
  const ax = err as AxiosError<BackendErrorPayload>
  if (!ax?.response) return 'Network error — backend unreachable'
  const data = ax.response.data
  if (data?.errors && Object.keys(data.errors).length > 0) {
    return Object.values(data.errors).join('; ')
  }
  if (typeof data === 'string') return data
  return data?.message || data?.error || `Request failed (${ax.response.status})`
}

export function extractFieldErrors(err: unknown): Record<string, string> {
  const ax = err as AxiosError<BackendErrorPayload>
  return ax?.response?.data?.errors ?? {}
}

// Callbacks set by BackendStatusContext
export let onBackendOnline: (() => void) | null = null
export let onBackendOffline: (() => void) | null = null
export const setStatusCallbacks = (
  onOnline: () => void,
  onOffline: () => void,
) => {
  onBackendOnline = onOnline
  onBackendOffline = onOffline
}

// Callback set by ToastContext — fires for non-silent API errors only.
export let onApiError: ((message: string, title?: string) => void) | null = null
export const setErrorCallback = (cb: (message: string, title?: string) => void) => {
  onApiError = cb
}

apiClient.interceptors.response.use(
  (response) => {
    onBackendOnline?.()
    if (response.config.method?.toLowerCase() === 'get') {
      const key = cacheKey(response.config)
      saveToCache(key, response.data)
    }
    return response
  },
  async (error: AxiosError) => {
    const isNetworkOrTimeout = !error.response || error.code === 'ECONNABORTED'
    if (isNetworkOrTimeout) {
      onBackendOffline?.()
      if (error.config?.method?.toLowerCase() === 'get') {
        const key = cacheKey(error.config)
        const cached = getFromCache(key)
        if (cached) {
          return Promise.resolve({
            data: cached.data,
            status: 200,
            statusText: 'OK (cached)',
            headers: {},
            config: error.config,
            isCached: true,
            cachedAt: cached.timestamp,
          })
        }
      }
      return Promise.reject(error)
    }

    const status = error.response!.status
    const url = error.config?.url ?? ''
    const refreshable = status === 401
      && error.config
      && !error.config._retry
      && !NO_REFRESH_PATHS.some((p) => url.includes(p))

    if (refreshable) {
      try {
        const newAccess = await refreshAccessToken()
        const cfg = error.config!
        cfg._retry = true
        cfg.headers.Authorization = `Bearer ${newAccess}`
        return apiClient(cfg)
      } catch {
        tokenStore.clear()
        onAuthLost?.()
        return Promise.reject(error)
      }
    }

    if (status === 401 && !NO_REFRESH_PATHS.some((p) => url.includes(p))) {
      // Refresh already failed (or no token) on a protected call → session is gone.
      tokenStore.clear()
      onAuthLost?.()
    } else if (!error.config?._silent && status >= 500) {
      // Only auto-toast server-side failures (5xx). 4xx are business/validation
      // errors that components are expected to render inline next to the form.
      onApiError?.(extractErrorMessage(error), 'Server Error')
    }
    return Promise.reject(error)
  },
)

function cacheKey(config: AxiosRequestConfig): string {
  const params = config.params ? JSON.stringify(config.params) : ''
  return `${config.url}${params}`
}
