import { apiClient } from './client'
import type { PersonKind, PersonResponse, PersonSummary } from '../types/people'

export const peopleApi = {
  /** Who the owner borrows from, by how much, largest first. */
  lenders: () => apiClient.get<PersonSummary[]>('/people/lenders'),
  /** Who borrows from the owner, by how much, largest first. */
  borrowers: () => apiClient.get<PersonSummary[]>('/people/borrowers'),
  /** Add a person; a name already on file comes back as that person. */
  create: (name: string, kind: PersonKind) => apiClient.post<PersonResponse>('/people', { name, kind }),
}
