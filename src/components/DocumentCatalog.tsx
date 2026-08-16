import type { ReactNode } from 'react';
import type { CatalogDocument, CatalogSortDirection, CatalogSortField } from '../types/catalog';
import type { CreatedPeriod, SearchDocument, SearchMatchMode, SearchSortField, SearchTextField } from '../types/search';

interface SearchControls {
  expanded: boolean;
  fields: SearchTextField[];
  matchMode: SearchMatchMode;
  createdPeriod: CreatedPeriod;
  validationMessage: string | null;
  onToggleExpanded: () => void;
  onFieldChange: (field: SearchTextField, checked: boolean) => void;
  onMatchModeChange: (mode: SearchMatchMode) => void;
  onCreatedPeriodChange: (period: CreatedPeriod) => void;
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
  title: string;
  eyebrow: string;
  searchControls: SearchControls;
  onSort: (field: CatalogSortField) => void;
  onOpenDocument: (id: number) => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onToggleNavigation: () => void;
  onToggleMetadata: () => void;
  onOpenTodo: () => void;
}

const columns: Array<{ field: CatalogSortField; label: string; className: string }> = [
  { field: 'title', label: 'Titre', className: 'catalog-title-column' },
  { field: 'folder', label: 'Dossier', className: 'catalog-folder-column' },
  { field: 'status', label: 'Statut', className: 'catalog-status-column' },
  { field: 'favorite', label: 'Favori', className: 'catalog-favorite-column' },
  { field: 'created_at', label: 'Créé', className: 'catalog-date-column' },
  { field: 'updated_at', label: 'Modifié', className: 'catalog-date-column' },
];

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
  title,
  eyebrow,
  searchControls,
  onSort,
  onOpenDocument,
  onSearchChange,
  onClearSearch,
  onToggleNavigation,
  onToggleMetadata,
  onOpenTodo,
}: DocumentCatalogProps) {
  return (
    <section className="pane editor-pane document-catalog" aria-labelledby="catalog-title">
      <header className="editor-toolbar catalog-header">
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
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="catalog-title">{title}</h1>
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
        <button
          className={searchControls.expanded ? 'advanced-search-button active' : 'advanced-search-button'}
          type="button"
          onClick={searchControls.onToggleExpanded}
          aria-expanded={searchControls.expanded}
        >
          Recherche avancée
        </button>
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
        <label className="created-period-control">
          <span>Créés</span>
          <select
            value={searchControls.createdPeriod}
            onChange={(event) => searchControls.onCreatedPeriodChange(event.currentTarget.value as CreatedPeriod)}
          >
            <option value="all">Toutes dates</option>
            <option value="last7days">7 derniers jours</option>
            <option value="last15days">15 derniers jours</option>
            <option value="last30days">30 derniers jours</option>
            <option value="thisYear">Cette année</option>
          </select>
        </label>
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
