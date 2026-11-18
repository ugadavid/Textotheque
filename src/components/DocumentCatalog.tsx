import type { ReactNode } from 'react';
import type { CatalogDocument, CatalogSortDirection, CatalogSortField } from '../types/catalog';
import type { DocumentStatus, Folder } from '../types/document';
import type { SavedSearchSummary } from '../types/saved-search';
import type {
  DatePeriod,
  SearchDateFilter,
  SearchDocument,
  SearchFolderSelection,
  SearchMatchMode,
  SearchSortField,
  SearchTextField,
} from '../types/search';

interface SearchControls {
  expanded: boolean;
  fields: SearchTextField[];
  matchMode: SearchMatchMode;
  folderSelection: SearchFolderSelection;
  statuses: DocumentStatus[];
  favoriteOnly: boolean;
  created: SearchDateFilter;
  modified: SearchDateFilter;
  validationMessage: string | null;
  onToggleExpanded: () => void;
  onFieldChange: (field: SearchTextField, checked: boolean) => void;
  onMatchModeChange: (mode: SearchMatchMode) => void;
  onFolderChange: (folderId: number, checked: boolean) => void;
  onUnclassifiedChange: (checked: boolean) => void;
  onStatusChange: (status: DocumentStatus, checked: boolean) => void;
  onFavoriteChange: (checked: boolean) => void;
  onDatePeriodChange: (field: 'created' | 'modified', period: DatePeriod) => void;
  onDateBoundaryChange: (field: 'created' | 'modified', boundary: 'from' | 'to', value: string | null) => void;
  onReset: () => void;
}

interface DocumentCatalogProps {
  documents: Array<CatalogDocument | SearchDocument>;
  sortBy: SearchSortField;
  direction: CatalogSortDirection;
  selectedDocumentId: number | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  navigationVisible: boolean;
  metadataVisible: boolean;
  isTodo: boolean;
  searching: boolean;
  onAdvancedSearch: () => void;
  folders: Folder[];
  activeSavedSearchName: string | null;
  activeSavedSearchId: number | null;
  savedSearchModified: boolean;
  savedSearches: SavedSearchSummary[];
  searchControls: SearchControls;
  onSort: (field: CatalogSortField) => void;
  onOpenDocument: (id: number) => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onToggleNavigation: () => void;
  onToggleMetadata: () => void;
  onOpenTodo: () => void;
  onSaveSearchAs: () => void;
  onUpdateSavedSearch: () => void;
  onRenameSavedSearch: () => void;
  onDeleteSavedSearch: () => void;
  onOpenSavedSearch: (id: number) => void;
}

const columns: Array<{ field: CatalogSortField; label: string; className: string }> = [
  { field: 'title', label: 'Titre', className: 'catalog-title-column' },
  { field: 'folder', label: 'Dossier', className: 'catalog-folder-column' },
  { field: 'status', label: 'Statut', className: 'catalog-status-column' },
  { field: 'favorite', label: 'Favori', className: 'catalog-favorite-column' },
  { field: 'created_at', label: 'Créé', className: 'catalog-date-column' },
  { field: 'updated_at', label: 'Modifié', className: 'catalog-date-column' },
];

const statuses: Array<[DocumentStatus, string]> = [
  ['draft', 'Brouillon'],
  ['active', 'Actif'],
  ['to_review', 'À revoir'],
  ['final', 'Final'],
  ['archived', 'Archivé'],
];

function folderDisplayPath(folder: Folder, foldersById: Map<number, Folder>): string {
  const parts = [folder.name];
  const visited = new Set([folder.id]);
  let parentId = folder.parent_id;
  while (parentId !== null && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = foldersById.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parent_id;
  }
  return parts.join(' › ');
}

function folderDepth(folder: Folder, foldersById: Map<number, Folder>): number {
  let depth = 0;
  const visited = new Set([folder.id]);
  let parentId = folder.parent_id;
  while (parentId !== null && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = foldersById.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parent_id;
  }
  return depth;
}

function hasSelectedAncestor(folder: Folder, foldersById: Map<number, Folder>, selectedIds: Set<number>): boolean {
  const visited = new Set([folder.id]);
  let parentId = folder.parent_id;
  while (parentId !== null && !visited.has(parentId)) {
    if (selectedIds.has(parentId)) return true;
    visited.add(parentId);
    parentId = foldersById.get(parentId)?.parent_id ?? null;
  }
  return false;
}

function DateFilterControl({
  field,
  label,
  value,
  onPeriodChange,
  onBoundaryChange,
}: {
  field: 'created' | 'modified';
  label: string;
  value: SearchDateFilter;
  onPeriodChange: SearchControls['onDatePeriodChange'];
  onBoundaryChange: SearchControls['onDateBoundaryChange'];
}) {
  return <div className="search-date-filter">
    <label className="search-select-control">
      <span>{label}</span>
      <select value={value.period} onChange={(event) => onPeriodChange(field, event.currentTarget.value as DatePeriod)}>
        <option value="all">Toutes dates</option>
        <option value="last7days">7 derniers jours</option>
        <option value="last15days">15 derniers jours</option>
        <option value="last30days">30 derniers jours</option>
        <option value="thisYear">Cette année</option>
        <option value="custom">Plage personnalisée…</option>
      </select>
    </label>
    {value.period === 'custom' ? <div className="custom-date-range">
      <label>Du <input type="date" value={value.from ?? ''} onChange={(event) => onBoundaryChange(field, 'from', event.currentTarget.value || null)} /></label>
      <label>Au <input type="date" value={value.to ?? ''} onChange={(event) => onBoundaryChange(field, 'to', event.currentTarget.value || null)} /></label>
    </div> : null}
  </div>;
}

function formatCatalogDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function renderSnippet(snippet: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let marked = false;
  for (let index = 0; index < snippet.length; index += 1) {
    const character = snippet[index];
    if (character !== '\uE000' && character !== '\uE001') continue;
    const text = snippet.slice(cursor, index);
    if (text) parts.push(marked ? <mark key={`${cursor}-mark`}>{text}</mark> : text);
    marked = character === '\uE000';
    cursor = index + 1;
  }
  const tail = snippet.slice(cursor);
  if (tail) parts.push(marked ? <mark key={`${cursor}-mark`}>{tail}</mark> : tail);
  return parts;
}

export default function DocumentCatalog({
  documents,
  sortBy,
  direction,
  selectedDocumentId,
  loading,
  error,
  searchQuery,
  navigationVisible,
  metadataVisible,
  isTodo,
  searching,
  onAdvancedSearch,
  folders,
  activeSavedSearchName,
  activeSavedSearchId,
  savedSearchModified,
  savedSearches,
  searchControls,
  onSort,
  onOpenDocument,
  onSearchChange,
  onClearSearch,
  onToggleNavigation,
  onToggleMetadata,
  onOpenTodo,
  onSaveSearchAs,
  onUpdateSavedSearch,
  onRenameSavedSearch,
  onDeleteSavedSearch,
  onOpenSavedSearch,
}: DocumentCatalogProps) {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const selectedFolderIds = new Set(searchControls.folderSelection.folderIds);
  const folderOptions = folders.map((folder) => ({
    folder,
    depth: folderDepth(folder, foldersById),
    path: folderDisplayPath(folder, foldersById),
    coveredByAncestor: hasSelectedAncestor(folder, foldersById, selectedFolderIds),
  }));
  const selectedBranchCount = searchControls.folderSelection.folderIds.length;
  const folderSummary = selectedBranchCount === 0
    ? searchControls.folderSelection.includeUnclassified ? 'Non classé' : 'Aucune branche'
    : `${selectedBranchCount} branche${selectedBranchCount > 1 ? 's' : ''}${searchControls.folderSelection.includeUnclassified ? ' + non classé' : ''}`;

  return (
    <section className="pane editor-pane document-catalog" aria-labelledby="catalog-title">
      <header className={searching ? "editor-toolbar catalog-header search-header" : "editor-toolbar catalog-header"}>
        <button
          className={navigationVisible ? 'pane-toggle-button toggle-navigation-button active' : 'pane-toggle-button toggle-navigation-button'}
          type="button"
          onClick={onToggleNavigation}
          title={navigationVisible ? 'Masquer la navigation' : 'Afficher la navigation'}
          aria-label={navigationVisible ? 'Masquer la navigation' : 'Afficher la navigation'}
          aria-pressed={navigationVisible}
        >
          <span className="navigation-toggle-icon" aria-hidden="true" />
        </button>
        <button
          className={isTodo ? 'todo-toolbar-button active' : 'todo-toolbar-button'}
          type="button"
          onClick={onOpenTodo}
          title="Ouvrir le TODO — Ctrl+Shift+T"
          aria-label="Ouvrir le TODO"
          aria-pressed={isTodo}
        >
          TODO
        </button>
        <div className="catalog-heading">
          {!searching && <p className="eyebrow">Bibliothèque</p>}
          <h1 id="catalog-title">{searching ? 'Recherche' : 'Tous les textes'}</h1>
          {activeSavedSearchName ? <p className="active-saved-search-label">
            Recherche enregistrée : {activeSavedSearchName}{savedSearchModified ? ' — modifiée' : ''}
          </p> : null}
        </div>
        <div className="toolbar-search search-input-row">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            type="text"
            inputMode="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher dans Textothèque..."
            aria-label="Rechercher dans Textothèque"
            title="Rechercher - Ctrl+F"
          />
          {searchQuery.trim() ? <button className="clear-search-button" type="button" onClick={onClearSearch} title="Vider la recherche" aria-label="Vider la recherche">×</button> : null}
        </div>
        <div className="advanced-search-actions">
          <button
            className={searching ? 'advanced-search-button active' : 'advanced-search-button'}
            type="button"
            onClick={onAdvancedSearch}
            aria-pressed={searching}
            title={searching ? 'Quitter la recherche avancée' : 'Ouvrir la recherche avancée'}
          >
            Recherche avancée
          </button>
          {searching && <button
            className="search-criteria-toggle"
            type="button"
            onClick={searchControls.onToggleExpanded}
            aria-expanded={searchControls.expanded}
            aria-label={searchControls.expanded ? 'Replier les critères' : 'Déplier les critères'}
            title={searchControls.expanded ? 'Replier les critères' : 'Déplier les critères'}
          ><span aria-hidden="true" /></button>}
        </div>
        <span className="catalog-count">
          {sortBy === 'relevance' ? 'Pertinence · ' : ''}
          {documents.length} document{documents.length > 1 ? 's' : ''}
        </span>
        <button
          className={metadataVisible ? 'pane-toggle-button toggle-metadata-button active' : 'pane-toggle-button toggle-metadata-button'}
          type="button"
          onClick={onToggleMetadata}
          title={metadataVisible ? 'Masquer les métadonnées' : 'Afficher les métadonnées'}
          aria-label={metadataVisible ? 'Masquer les métadonnées' : 'Afficher les métadonnées'}
          aria-pressed={metadataVisible}
        >
          <span className="metadata-toggle-icon" aria-hidden="true" />
        </button>
      </header>

      {searchControls.expanded ? <section className="advanced-search-panel" aria-label="Critères de recherche avancée">
        <fieldset>
          <legend>Chercher dans</legend>
          {([
            ['title', 'Titre'],
            ['content', 'Corps du texte'],
            ['notes', 'Notes internes'],
          ] as Array<[SearchTextField, string]>).map(([field, label]) => <label key={field}>
            <input
              type="checkbox"
              checked={searchControls.fields.includes(field)}
              onChange={(event) => searchControls.onFieldChange(field, event.currentTarget.checked)}
            />
            {label}
          </label>)}
        </fieldset>
        <fieldset>
          <legend>Correspondance</legend>
          {([
            ['all', 'Tous les mots'],
            ['any', 'Au moins un mot'],
            ['phrase', 'Expression exacte'],
          ] as Array<[SearchMatchMode, string]>).map(([mode, label]) => <label key={mode}>
            <input
              type="radio"
              name="search-match-mode"
              value={mode}
              checked={searchControls.matchMode === mode}
              onChange={() => searchControls.onMatchModeChange(mode)}
            />
            {label}
          </label>)}
        </fieldset>
        <div className="structured-search-controls">
          <details className="folder-filter-menu">
            <summary><span>Dossiers</span><strong>{folderSummary}</strong></summary>
            <div className="folder-filter-popover">
              <label className="folder-filter-option unclassified-option">
                <input type="checkbox" checked={searchControls.folderSelection.includeUnclassified} onChange={(event) => searchControls.onUnclassifiedChange(event.currentTarget.checked)} />
                Non classé
              </label>
              <div className="folder-filter-tree">
                {folderOptions.map(({ folder, depth, path, coveredByAncestor }) => <label
                  className={coveredByAncestor ? 'folder-filter-option ancestor-covered' : 'folder-filter-option'}
                  key={folder.id}
                  style={{ paddingLeft: `${8 + depth * 16}px` }}
                  title={path}
                >
                  <input
                    type="checkbox"
                    value={folder.id}
                    checked={selectedFolderIds.has(folder.id)}
                    disabled={coveredByAncestor}
                    onChange={(event) => searchControls.onFolderChange(folder.id, event.currentTarget.checked)}
                  />
                  <span>{folder.name}</span>
                  {coveredByAncestor ? <small>déjà inclus</small> : null}
                </label>)}
              </div>
              <p>Un dossier sélectionné inclut ses sous-dossiers.</p>
            </div>
          </details>
          <fieldset className="status-filter-options">
            <legend>Statuts</legend>
            {statuses.map(([value, label]) => <label key={value}>
              <input type="checkbox" value={value} checked={searchControls.statuses.includes(value)} onChange={(event) => searchControls.onStatusChange(value, event.currentTarget.checked)} />
              {label}
            </label>)}
          </fieldset>
          <label className="favorite-only-filter">
            <input type="checkbox" checked={searchControls.favoriteOnly} onChange={(event) => searchControls.onFavoriteChange(event.currentTarget.checked)} />
            Favoris seulement
          </label>
        </div>
        <div className="search-date-controls">
          <DateFilterControl field="created" label="Créé" value={searchControls.created} onPeriodChange={searchControls.onDatePeriodChange} onBoundaryChange={searchControls.onDateBoundaryChange} />
          <DateFilterControl field="modified" label="Modifié" value={searchControls.modified} onPeriodChange={searchControls.onDatePeriodChange} onBoundaryChange={searchControls.onDateBoundaryChange} />
          <label className="search-select-control saved-search-select-control">
            <span>Recherche enregistrée</span>
            <select
              className="saved-search-select"
              value={activeSavedSearchId ?? ''}
              title={savedSearchModified ? 'Critères modifiés depuis la dernière sauvegarde' : undefined}
              onChange={(event) => {
                const id = Number(event.currentTarget.value);
                if (Number.isSafeInteger(id) && id > 0) onOpenSavedSearch(id);
              }}
            >
              <option value="">Recherches enregistrées…</option>
              {savedSearches.map((savedSearch) => <option key={savedSearch.id} value={savedSearch.id}>
                {savedSearch.name}{savedSearch.id === activeSavedSearchId && savedSearchModified ? ' *' : ''}
              </option>)}
            </select>
          </label>
        </div>
        <div className="saved-search-actions">
          <button type="button" onClick={onSaveSearchAs}>{activeSavedSearchName ? 'Enregistrer sous…' : 'Enregistrer la recherche…'}</button>
          {activeSavedSearchName ? <>
            <button type="button" onClick={onUpdateSavedSearch} disabled={!savedSearchModified}>Mettre à jour</button>
            <button type="button" onClick={onRenameSavedSearch}>Renommer…</button>
            <button type="button" onClick={onDeleteSavedSearch}>Supprimer…</button>
          </> : null}
          <button className="reset-search-button" type="button" onClick={searchControls.onReset}>Réinitialiser</button>
        </div>
        {searchControls.validationMessage ? <p className="search-validation-message" role="status">{searchControls.validationMessage}</p> : null}
      </section> : null}

      {error ? <p className="error-message">{error}</p> : null}
      <div className="catalog-table-region">
        <table className="catalog-table">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sortBy === column.field;
                const marker = active ? (direction === 'asc' ? '↑' : '↓') : '';
                return (
                  <th className={column.className} key={column.field} scope="col">
                    <button
                      type="button"
                      className={active ? 'catalog-sort-button active' : 'catalog-sort-button'}
                      onClick={() => onSort(column.field)}
                      aria-label={`Trier par ${column.label}${active ? `, ordre ${direction === 'asc' ? 'croissant' : 'décroissant'}` : ''}`}
                    >
                      {column.label} <span aria-hidden="true">{marker}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => {
              const selected = document.id === selectedDocumentId;
              return (
                <tr
                  className={selected ? 'catalog-row selected' : 'catalog-row'}
                  key={document.id}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onOpenDocument(document.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onOpenDocument(document.id);
                    }
                  }}
                >
                  <td className="catalog-title-cell">
                    <span className="catalog-title-content">
                      <span className="catalog-cell-text">{document.title.trim() || 'Sans titre'}</span>
                      {'snippet' in document && document.snippet ? <span className="catalog-snippet">{renderSnippet(document.snippet)}</span> : null}
                    </span>
                    {document.specialRole === 'todo' ? <span className="catalog-todo-badge">TODO</span> : null}
                  </td>
                  <td><span className="catalog-cell-text">{document.folderName ?? 'Non classé'}</span></td>
                  <td><span className="catalog-status-badge">{document.status}</span></td>
                  <td className="catalog-favorite-cell" aria-label={document.favorite ? 'Favori' : 'Non favori'}>
                    {document.favorite ? '★' : ''}
                  </td>
                  <td><time dateTime={document.createdAt}>{formatCatalogDate(document.createdAt)}</time></td>
                  <td><time dateTime={document.updatedAt}>{formatCatalogDate(document.updatedAt)}</time></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && documents.length === 0 ? <p className="catalog-empty">Aucun document actif.</p> : null}
        {loading ? <p className="catalog-loading" role="status">Chargement du catalogue…</p> : null}
      </div>
    </section>
  );
}
