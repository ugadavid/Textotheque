import { useEffect, useMemo, useState } from 'react';
import type { Folder, TextDocument } from '../types/document';

const UNTITLED_FALLBACK = 'Sans titre';
const COLLAPSED_FOLDERS_KEY = 'textotheque:collapsed-folders:v1';
type DocumentView = 'all' | 'unfiled' | 'folder' | 'trash';

interface NavigationPaneProps {
  documents: TextDocument[];
  allDocuments: TextDocument[];
  folders: Folder[];
  currentView: DocumentView;
  selectedFolderId: number | null;
  activeCount: number;
  unfiledCount: number;
  folderDocumentCounts: Record<number, number>;
  trashCount: number;
  totalDocuments: number;
  searchQuery: string;
  selectedDocumentId: number | null;
  dirtyDocumentId: number | null;
  onViewChange: (view: DocumentView, folderId?: number | null) => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onCreateDocument: () => void;
  onCreateFolder: (parentId: number | null) => void;
  onRenameFolder: (id: number, name: string) => void;
  onSelectDocument: (id: number, view?: DocumentView, folderId?: number | null) => void;
  onEmptyTrash: () => void;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Jamais ouvert';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function buildFolderRows(
  folders: Folder[],
  collapsedFolderIds: Set<number>,
  parentId: number | null = null,
  depth = 0
): Array<Folder & { depth: number }> {
  return folders
    .filter((folder) => folder.parent_id === parentId)
    .flatMap((folder) => [
      { ...folder, depth },
      ...(collapsedFolderIds.has(folder.id) ? [] : buildFolderRows(folders, collapsedFolderIds, folder.id, depth + 1)),
    ]);
}

function displayTitle(document: TextDocument): string {
  return document.title.trim() || UNTITLED_FALLBACK;
}

function loadCollapsedFolderIds(): Set<number> {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_FOLDERS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'number')) : new Set();
  } catch {
    return new Set();
  }
}

function folderAncestorIds(folders: Folder[], folderId: number | null): number[] {
  const ancestors: number[] = [];
  let currentFolder = folders.find((folder) => folder.id === folderId) ?? null;

  while (currentFolder?.parent_id !== null && currentFolder?.parent_id !== undefined) {
    ancestors.unshift(currentFolder.parent_id);
    currentFolder = folders.find((folder) => folder.id === currentFolder?.parent_id) ?? null;
  }

  return ancestors;
}

export default function NavigationPane({
  documents,
  allDocuments,
  folders,
  currentView,
  selectedFolderId,
  activeCount,
  unfiledCount,
  folderDocumentCounts,
  trashCount,
  totalDocuments,
  searchQuery,
  selectedDocumentId,
  dirtyDocumentId,
  onViewChange,
  onSearchChange,
  onClearSearch,
  onCreateDocument,
  onCreateFolder,
  onRenameFolder,
  onSelectDocument,
  onEmptyTrash,
}: NavigationPaneProps) {
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<number>>(() => loadCollapsedFolderIds());
  const hasSearch = searchQuery.trim().length > 0;
  const folderRows = useMemo(() => buildFolderRows(folders, collapsedFolderIds), [collapsedFolderIds, folders]);
  const currentFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const unfiledDocuments = allDocuments.filter((document) => document.folder_id === null);
  const showClassicDocumentList = hasSearch || currentView === 'all' || currentView === 'trash';
  const summaryLabel = hasSearch
    ? 'Resultats'
    : currentView === 'trash'
      ? 'Corbeille'
      : currentView === 'unfiled'
        ? 'Non classes'
        : currentView === 'folder'
          ? currentFolder?.name ?? 'Dossier'
          : 'Tous les textes';

  useEffect(() => {
    window.localStorage.setItem(COLLAPSED_FOLDERS_KEY, JSON.stringify([...collapsedFolderIds]));
  }, [collapsedFolderIds]);

  useEffect(() => {
    const selectedDocument = allDocuments.find((document) => document.id === selectedDocumentId) ?? null;
    const folderToReveal = selectedDocument?.folder_id ?? selectedFolderId;
    if (folderToReveal === null || folderToReveal === undefined) {
      return;
    }

    const idsToOpen = [...folderAncestorIds(folders, folderToReveal), folderToReveal];
    setCollapsedFolderIds((current) => {
      if (idsToOpen.every((id) => !current.has(id))) {
        return current;
      }

      const next = new Set(current);
      idsToOpen.forEach((id) => next.delete(id));
      return next;
    });
  }, [allDocuments, folders, selectedDocumentId, selectedFolderId]);

  function toggleFolder(folderId: number) {
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  return (
    <aside className="pane navigation-pane">
      <div className="pane-header">
        <div>
          <p className="eyebrow">Textotheque</p>
          <h1>Documents</h1>
        </div>
        <button className="icon-button" type="button" onClick={onCreateDocument} title="Nouveau document - Ctrl+N">
          +
        </button>
      </div>

      <div className="nav-summary">
        <span>{summaryLabel}</span>
        <strong>
          {hasSearch ? `${documents.length}/${totalDocuments}` : totalDocuments}
        </strong>
      </div>

      <div className="nav-view-switch" aria-label="Vue des documents">
        <button
          className={currentView === 'all' ? 'nav-view-button selected' : 'nav-view-button'}
          type="button"
          onClick={() => onViewChange('all', null)}
        >
          Tous les textes <span>{activeCount}</span>
        </button>
        <button
          className={currentView === 'trash' ? 'nav-view-button selected' : 'nav-view-button'}
          type="button"
          onClick={() => onViewChange('trash', null)}
        >
          Corbeille <span>{trashCount}</span>
        </button>
      </div>

      {currentView === 'trash' ? (
        <button
          className="empty-trash-button"
          type="button"
          onClick={onEmptyTrash}
          disabled={trashCount === 0}
        >
          Vider la corbeille
        </button>
      ) : null}

      <section className="folder-section" aria-label="Dossiers virtuels">
        <div className="folder-section-header">
          <span>Dossiers</span>
          <div className="folder-actions">
            <button type="button" onClick={() => onCreateFolder(null)} title="Nouveau dossier racine">
              +
            </button>
            {currentView === 'folder' && selectedFolderId !== null ? (
              <button type="button" onClick={() => onCreateFolder(selectedFolderId)} title="Nouveau sous-dossier">
                +/
              </button>
            ) : null}
          </div>
        </div>
        {folderRows.length === 0 ? (
          <p className="folder-empty">Aucun dossier.</p>
        ) : (
          <div className="folder-list">
            {folderRows.map((folder) => {
              const isSelected = currentView === 'folder' && selectedFolderId === folder.id;
              const isEditing = editingFolderId === folder.id;
              const isCollapsed = collapsedFolderIds.has(folder.id);
              const documentCount = folderDocumentCounts[folder.id] ?? 0;
              const folderDocuments = hasSearch
                || isCollapsed
                ? []
                : allDocuments.filter((document) => document.folder_id === folder.id);

              function startRename() {
                setEditingFolderId(folder.id);
                setEditingFolderName(folder.name);
              }

              function commitRename(nextName = editingFolderName) {
                onRenameFolder(folder.id, nextName);
                setEditingFolderId(null);
                setEditingFolderName('');
              }

              return (
                <div className="folder-row" key={folder.id}>
                  {isEditing ? (
                    <input
                      className="folder-name-input"
                      value={editingFolderName}
                      autoFocus
                      style={{ marginLeft: `${folder.depth * 14}px` }}
                      onChange={(event) => setEditingFolderName(event.target.value)}
                      onBlur={(event) => commitRename(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                          setEditingFolderId(null);
                          setEditingFolderName('');
                        }
                      }}
                    />
                  ) : (
                    <>
                      <button
                        className="folder-toggle-button"
                        type="button"
                        style={{ marginLeft: `${folder.depth * 14}px` }}
                        onClick={() => toggleFolder(folder.id)}
                        title={isCollapsed ? 'Deplier le dossier' : 'Replier le dossier'}
                        aria-label={isCollapsed ? 'Deplier le dossier' : 'Replier le dossier'}
                      >
                        {isCollapsed ? '>' : 'v'}
                      </button>
                      <button
                        className={isSelected ? 'folder-button selected' : 'folder-button'}
                        type="button"
                        onClick={() => onViewChange('folder', folder.id)}
                        onDoubleClick={startRename}
                        title="Double-clic pour renommer"
                      >
                        <span>{folder.depth > 0 ? '- ' : ''}{folder.name}</span>
                        <strong>{documentCount}</strong>
                      </button>
                      {isSelected ? (
                        <button className="folder-rename-button" type="button" onClick={startRename}>
                          Renommer
                        </button>
                      ) : null}
                    </>
                  )}
                  {folderDocuments.map((document) => {
                    const isDocumentSelected = selectedDocumentId === document.id;
                    const isDirty = dirtyDocumentId === document.id;

                    return (
                      <button
                        className={
                          isDocumentSelected
                            ? 'tree-document-button selected'
                            : 'tree-document-button'
                        }
                        key={document.id}
                        type="button"
                        style={{ marginLeft: `${18 + folder.depth * 14}px` }}
                        onClick={() => onSelectDocument(document.id, 'folder', folder.id)}
                      >
                        <span>
                          {isDirty ? <span className="dirty-marker">*</span> : null}
                          {document.favorite ? '* ' : ''}
                          {displayTitle(document)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!hasSearch ? (
        <section className="unfiled-tree-section" aria-label="Documents non classes">
          <button
            className={currentView === 'unfiled' ? 'nav-view-button selected' : 'nav-view-button'}
            type="button"
            onClick={() => onViewChange('unfiled', null)}
          >
            Non classes <span>{unfiledCount}</span>
          </button>
          <div className="tree-document-list">
            {unfiledDocuments.length === 0 ? (
              <p className="folder-empty">Aucun document non classe.</p>
            ) : (
              unfiledDocuments.map((document) => {
                const isDocumentSelected = selectedDocumentId === document.id;
                const isDirty = dirtyDocumentId === document.id;

                return (
                  <button
                    className={isDocumentSelected ? 'tree-document-button selected' : 'tree-document-button'}
                    key={document.id}
                    type="button"
                    onClick={() => onSelectDocument(document.id, 'unfiled', null)}
                  >
                    <span>
                      {isDirty ? <span className="dirty-marker">*</span> : null}
                      {document.favorite ? '* ' : ''}
                      {displayTitle(document)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      ) : null}

      <label className="search-field">
        <span>Recherche</span>
        <div className="search-input-row">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Titre ou contenu..."
            aria-label="Rechercher dans les documents"
            title="Rechercher - Ctrl+F"
          />
          {hasSearch ? (
            <button className="clear-search-button" type="button" onClick={onClearSearch} title="Vider la recherche">
              x
            </button>
          ) : null}
        </div>
      </label>

      {showClassicDocumentList ? (
        <div className="document-list" aria-label="Liste des documents">
          {documents.length === 0 ? (
            <p className="empty-state">
              {hasSearch ? 'Aucun document trouve.' : currentView === 'trash' ? 'La corbeille est vide.' : 'Aucun document pour le moment.'}
            </p>
          ) : (
            documents.map((document) => {
              const isDirty = dirtyDocumentId === document.id;

              return (
                <button
                  className={document.id === selectedDocumentId ? 'document-item selected' : 'document-item'}
                  key={document.id}
                  type="button"
                  onClick={() => onSelectDocument(document.id)}
                >
                  <span className="document-title">
                    {isDirty ? <span className="dirty-marker">*</span> : null}
                    {document.favorite ? '* ' : ''}
                    {displayTitle(document)}
                  </span>
                  <span className="document-meta">
                    {document.status} - {formatDate(document.updated_at)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </aside>
  );
}
