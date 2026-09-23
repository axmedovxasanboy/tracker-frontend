import { apiClient } from './client'
import type { EmergencyRequest, EmergencyResponse } from '../types'

const base = '/emergencies'

export const emergenciesApi = {
  getAll: () => apiClient.get<EmergencyResponse[]>(base),
  create: (req: EmergencyRequest) => apiClient.post<EmergencyResponse>(base, req),
  delete: (id: number) => apiClient.delete(`${base}/${id}`),
}
