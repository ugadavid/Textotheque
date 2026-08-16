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

export function buildSearchMenu(
  savedSearches: SavedSearchSummary[],
  state: SearchMenuState,
  send: (action: SearchMenuAction) => void
): MenuItemConstructorOptions {
  const savedItems: MenuItemConstructorOptions[] = savedSearches.length > 0
    ? savedSearches.map((savedSearch) => ({
        label: savedSearch.name,
        type: 'checkbox',
        checked: savedSearch.id === state.activeSavedSearchId,
        click: () => send({ action: 'open', id: savedSearch.id }),
      }))
    : [{ label: 'Aucune recherche enregistrée', enabled: false }];
  return {
    label: 'Recherche',
    submenu: [
      { label: 'Rechercher…', accelerator: 'CommandOrControl+F', click: () => send({ action: 'focus' }) },
      { label: 'Recherche avancée…', click: () => send({ action: 'advanced' }) },
      { type: 'separator' },
      { label: 'Enregistrer la recherche sous…', enabled: state.canSave, click: () => send({ action: 'save-as' }) },
      { label: 'Mettre à jour la recherche', enabled: state.activeSavedSearchId !== null && state.modified, click: () => send({ action: 'update' }) },
      { label: 'Renommer la recherche…', enabled: state.activeSavedSearchId !== null, click: () => send({ action: 'rename' }) },
      { label: 'Supprimer la recherche…', enabled: state.activeSavedSearchId !== null, click: () => send({ action: 'delete' }) },
      { type: 'separator' },
      { label: 'Recherches enregistrées', submenu: savedItems },
    ],
  };
}
import type { MenuItemConstructorOptions } from 'electron';
import type { SavedSearchSummary } from './database.js';
