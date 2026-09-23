import { apiClient } from './client'
import type { CardRequest, CardResponse } from '../types'

export const cardsApi = {
  getAll: () => apiClient.get<CardResponse[]>('/cards'),
  create: (data: CardRequest) => apiClient.post<CardResponse>('/cards', data),
  update: (id: number, data: CardRequest) => apiClient.put<CardResponse>(`/cards/${id}`, data),
  delete: (id: number) => apiClient.delete(`/cards/${id}`),
}
