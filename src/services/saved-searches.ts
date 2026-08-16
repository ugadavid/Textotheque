import type { SearchDocumentsOptions } from '../types/search';
import type { SavedSearchDefinition, SavedSearchInput, SavedSearchSummary, SearchMenuState } from '../types/saved-search';

export async function listSavedSearches(): Promise<SavedSearchSummary[]> {
  return window.textotheque.listSavedSearches();
}

export async function getSavedSearch(id: number): Promise<SavedSearchDefinition | null> {
  return window.textotheque.getSavedSearch(id);
}

export async function createSavedSearch(input: SavedSearchInput, expectedLibraryPath: string): Promise<SavedSearchDefinition> {
  return window.textotheque.createSavedSearch(input, expectedLibraryPath);
}

export async function updateSavedSearch(id: number, criteria: SearchDocumentsOptions, expectedLibraryPath: string): Promise<SavedSearchDefinition> {
  return window.textotheque.updateSavedSearch(id, criteria, expectedLibraryPath);
}

export async function renameSavedSearch(id: number, name: string, expectedLibraryPath: string): Promise<SavedSearchDefinition> {
  return window.textotheque.renameSavedSearch(id, name, expectedLibraryPath);
}

export async function deleteSavedSearch(id: number, expectedLibraryPath: string): Promise<void> {
  return window.textotheque.deleteSavedSearch(id, expectedLibraryPath);
}

export async function setSearchMenuState(state: SearchMenuState): Promise<void> {
  return window.textotheque.setSearchMenuState(state);
}
