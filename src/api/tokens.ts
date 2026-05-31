// JWT storage (localStorage). Kept dependency-free so api/client.ts can import it without a cycle.
const ACCESS = 'tracker_access_token'
const REFRESH = 'tracker_refresh_token'

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS),
  getRefresh: () => localStorage.getItem(REFRESH),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS, access)
    localStorage.setItem(REFRESH, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS)
    localStorage.removeItem(REFRESH)
  },
}
