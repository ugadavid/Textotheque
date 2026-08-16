import type { CatalogDocument, CatalogSortDirection, CatalogSortField } from '../types/catalog';

interface DocumentCatalogProps {
  documents: CatalogDocument[];
  sortBy: CatalogSortField;
  direction: CatalogSortDirection;
  selectedDocumentId: number | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  navigationVisible: boolean;
  metadataVisible: boolean;
  isTodo: boolean;
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
          <p className="eyebrow">Bibliothèque</p>
          <h1 id="catalog-title">Tous les textes</h1>
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
        <span className="catalog-count">{documents.length} document{documents.length > 1 ? 's' : ''}</span>
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
                    <span className="catalog-cell-text">{document.title.trim() || 'Sans titre'}</span>
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
