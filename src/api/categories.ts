import { apiClient } from './client'
import type { Category, CategoryRequest, CategoryType, TransactionSubType } from '../types'

export const categoriesApi = {
  getAll: (type?: CategoryType, subType?: TransactionSubType) => {
    const params: Record<string, string> = {}
    if (type) params.type = type
    if (subType) params.subType = subType
    return apiClient.get<Category[]>('/categories', { params: Object.keys(params).length ? params : undefined })
  },

  create: (data: CategoryRequest) =>
    apiClient.post<Category>('/categories', data),

  update: (id: number, data: CategoryRequest) =>
    apiClient.put<Category>(`/categories/${id}`, data),

  getSubCategories: (parentId: number) =>
    apiClient.get<Category[]>(`/categories/${parentId}/sub-categories`),

  delete: (id: number) =>
    apiClient.delete(`/categories/${id}`),
}
