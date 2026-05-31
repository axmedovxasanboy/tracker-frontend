import { apiClient } from './client'

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

export interface AuthStatus {
  needsSignup: boolean
}

export const authApi = {
  // Public: drives login-vs-signup routing. _silent so a transient failure doesn't toast.
  status: () => apiClient.get<AuthStatus>('/auth/status', { _silent: true }),
  signup: (username: string, password: string) =>
    apiClient.post<TokenResponse>('/auth/signup', { username, password }),
  login: (username: string, password: string) =>
    apiClient.post<TokenResponse>('/auth/login', { username, password }),
  me: () => apiClient.get<{ username: string }>('/auth/me', { _silent: true }),
}
