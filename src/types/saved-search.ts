import type { SearchDocumentsOptions } from './search';

export interface SavedSearchSummary {
  id: number;
  name: string;
  updatedAt: string;
}

export interface SavedSearchInput extends SearchDocumentsOptions {
  name: string;
}

export interface SavedSearchDefinition extends SavedSearchInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export type SearchMenuAction =
  | { action: 'focus' }
  | { action: 'advanced' }
  | { action: 'save-as' }
  | { action: 'update' }
  | { action: 'rename' }
  | { action: 'delete' }
  | { action: 'open'; id: number };

export interface SearchMenuState {
  activeSavedSearchId: number | null;
  modified: boolean;
  canSave: boolean;
}
