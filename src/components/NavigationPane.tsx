import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import type { Folder, TextDocument } from '../types/document';
import type { ExplorerOrder } from '../services/explorer-order';

const EXPANDED_FOLDERS_KEY = 'textotheque:expanded-folders:v2';
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
type DocumentView = 'navigation' | 'all' | 'unfiled' | 'folder' | 'trash';

type DocumentAction = 'rename' | 'trash' | 'restore';
type MenuTarget = { folder: Folder } | { doc: TextDocument; view: DocumentView };

interface NavigationPaneProps {
  explorerOrder: ExplorerOrder;
  allDocuments: TextDocument[];
  deletedDocuments: TextDocument[];
  folders: Folder[];
  currentView: DocumentView;
  selectedFolderId: number | null;
  activeCount: number;
  unfiledCount: number;
  folderDocumentCounts: Record<number, number>;
  trashCount: number;
  selectedDocumentId: number | null;
  dirtyDocumentId: number | null;
  onViewChange: (view: DocumentView, folderId?: number | null) => void;
  onCreateDocument: () => void;
  onCreateFolder: (parentId: number | null) => void;
  onRenameFolder: (id: number, name: string) => void;
  onSelectDocument: (id: number, view?: DocumentView, folderId?: number | null) => void;
  editingFolderId: number | null;
  onEditFolder: (id: number | null) => void;
  onDeleteFolder: (folder: Folder) => void;
  onDocumentAction: (doc: TextDocument, view: DocumentView, action: DocumentAction) => void;
  branchSelected: boolean;
  onEmptyTrash: () => void;
}

function loadExpandedFolderIds(): Set<number> {
  try {
    const value = window.localStorage.getItem(EXPANDED_FOLDERS_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'number')) : new Set();
  } catch {
    return new Set();
  }
}

function buildFolderRows(
  folders: Folder[],
  expandedIds: Set<number>,
  order: ExplorerOrder,
  parentId: number | null = null,
  depth = 0
): Array<Folder & { depth: number }> {
  const siblings = folders.filter((folder) => folder.parent_id === parentId);
  if (order === 'alphabetical') siblings.sort((a, b) => collator.compare(a.name, b.name));
  return siblings.flatMap((folder) => [
    { ...folder, depth },
    ...(expandedIds.has(folder.id) ? buildFolderRows(folders, expandedIds, order, folder.id, depth + 1) : []),
  ]);
}

function folderAncestorIds(folders: Folder[], folderId: number): number[] {
  const result: number[] = [];
  let folder = folders.find((item) => item.id === folderId);
  const visited = new Set<number>();
  while (folder?.parent_id !== null && folder?.parent_id !== undefined && !visited.has(folder.id)) {
    visited.add(folder.id);
    result.unshift(folder.parent_id);
    folder = folders.find((item) => item.id === folder?.parent_id);
  }
  return result;
}

function folderPath(folders: Folder[], folderId: number | null): string {
  if (folderId === null) return 'Non classés';
  const names: string[] = [];
  let folder = folders.find((item) => item.id === folderId);
  const visited = new Set<number>();
  while (folder && !visited.has(folder.id)) {
    visited.add(folder.id);
    names.unshift(folder.name);
    folder = folders.find((item) => item.id === folder?.parent_id);
  }
  return names.join(' / ') || 'Dossier inconnu';
}

function displayTitle(document: TextDocument): string {
  return document.title.trim() || 'Sans titre';
}

export default function NavigationPane(props: NavigationPaneProps) {
  const {
    allDocuments, deletedDocuments, folders, currentView, selectedFolderId, explorerOrder,
    activeCount, unfiledCount, folderDocumentCounts, trashCount,
    selectedDocumentId, dirtyDocumentId, onViewChange, onCreateDocument, onCreateFolder,
    onRenameFolder, onSelectDocument, onEmptyTrash,
  } = props;
  const { editingFolderId, onEditFolder } = props;
  const [folderMenu, setFolderMenu] = useState<{
    target: MenuTarget; x: number; y: number; trigger: HTMLButtonElement;
  } | null>(null);

  function openMenu(event: MouseEvent<HTMLButtonElement>, target: MenuTarget) {
    event.preventDefault();
    const trigger = event.currentTarget;
    const rect = trigger.getBoundingClientRect();
    const keyboard = event.clientX === 0 && event.clientY === 0;
    setFolderMenu({ target, trigger, x: keyboard ? rect.left : event.clientX, y: keyboard ? rect.bottom : event.clientY });
  }

  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(loadExpandedFolderIds);
  const [isUnfiledExpanded, setIsUnfiledExpanded] = useState(false);
  const isNavigationMode = ['navigation', 'folder', 'unfiled'].includes(currentView);
  const folderRows = useMemo(() => buildFolderRows(folders, expandedFolderIds, explorerOrder), [folders, expandedFolderIds, explorerOrder]);
  const treeDocuments = useMemo(
    () => allDocuments.filter((document) => document.special_role !== 'todo'),
    [allDocuments]
  );
  const documentsByFolder = useMemo(() => {
    const groups = new Map<number | null, TextDocument[]>();
    for (const document of treeDocuments) {
      const group = groups.get(document.folder_id);
      if (group) group.push(document);
      else groups.set(document.folder_id, [document]);
    }
    if (explorerOrder === 'alphabetical') {
      for (const group of groups.values()) group.sort((a, b) => collator.compare(displayTitle(a), displayTitle(b)));
    }
    return groups;
  }, [treeDocuments, explorerOrder]);
  const unfiledDocuments = documentsByFolder.get(null) ?? [];

  useEffect(() => {
    if (!folderMenu) return;
    const close = () => setFolderMenu(null);
    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Element && event.target.closest('.folder-context-menu'))) close();
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('blur', close);
    };
  }, [folderMenu]);

  useEffect(() => {
    window.localStorage.setItem(EXPANDED_FOLDERS_KEY, JSON.stringify([...expandedFolderIds]));
  }, [expandedFolderIds]);

  useEffect(() => {
    if (!isNavigationMode) return;
    const selectedDocument = treeDocuments.find((document) => document.id === selectedDocumentId);
    const folderId = selectedDocument?.folder_id ?? selectedFolderId;
    if (folderId === null || folderId === undefined) {
      if (selectedDocument || currentView === 'unfiled') setIsUnfiledExpanded(true);
      return;
    }
    const idsToOpen = [...folderAncestorIds(folders, folderId), folderId];
    setExpandedFolderIds((current) => {
      if (idsToOpen.every((id) => current.has(id))) return current;
      const next = new Set(current);
      idsToOpen.forEach((id) => next.add(id));
      return next;
    });
  }, [currentView, folders, isNavigationMode, selectedDocumentId, selectedFolderId, treeDocuments]);

  useEffect(() => {
    if (editingFolderId === null) return;
    const ancestors = folderAncestorIds(folders, editingFolderId);
    setExpandedFolderIds(current => ancestors.every(id => current.has(id))
      ? current : new Set([...current, ...ancestors]));
  }, [editingFolderId, folders]);

  function toggleFolder(folderId: number) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function markers(document: TextDocument) {
    return <>
      {dirtyDocumentId === document.id ? <span className="dirty-marker" title="Modifications non sauvegardées">*</span> : null}
      {document.favorite ? <span className="favorite-marker" title="Favori">★</span> : null}
    </>;
  }

  function simpleList(source: TextDocument[], label: string, empty: string, view: DocumentView) {
    return <section className="navigation-mode" aria-label={label}>
      <div className="navigation-mode-header"><span>{label}</span><strong>{source.length}</strong></div>
      {source.length === 0 ? <p className="empty-state">{empty}</p> : <div className="document-list">
        {source.map((document) => <button
          className={document.id === selectedDocumentId ? 'document-item selected' : 'document-item'}
          key={document.id}
          type="button"
          onContextMenu={event => openMenu(event, { doc: document, view })}
          onClick={() => onSelectDocument(document.id, view, null)}
        >
          <span className="document-title"><span className="document-icon" aria-hidden="true" />{markers(document)}{displayTitle(document)}</span>
          {!document.deleted_at ? <span className="document-path">{folderPath(folders, document.folder_id)}</span> : null}
        </button>)}
      </div>}
    </section>;
  }

  const target = folderMenu?.target;
  function menuButton(label: string, action: () => void, first = false) {
    return <button type="button" role="menuitem" autoFocus={first} onClick={() => {
      setFolderMenu(null);
      action();
    }}>{label}</button>;
  }

  return <aside className="pane navigation-pane">
    <div className="pane-header navigation-header">
      <button className="navigation-home" type="button" onClick={() => onViewChange('navigation', null)} title="Retour à la navigation">
        <span className="eyebrow">Textothèque</span><strong>Bibliothèque</strong>
      </button>
      <button className="icon-button" type="button" onClick={onCreateDocument} title="Nouveau document - Ctrl+N">+</button>
    </div>

    <div className="nav-view-switch" aria-label="Vue des documents">
      <button className={currentView === 'all' ? 'nav-view-button selected' : 'nav-view-button'} type="button" onClick={() => onViewChange('all', null)}>
        Tous les textes <span>{activeCount}</span>
      </button>
      <button className={currentView === 'trash' ? 'nav-view-button selected' : 'nav-view-button'} type="button" onClick={() => onViewChange('trash', null)}>
        Corbeille <span>{trashCount}</span>
      </button>
    </div>

    <div className="navigation-scroll-region">
      {currentView === 'all' ? simpleList(allDocuments, 'Tous les textes', 'Aucun document pour le moment.', 'all') : null}
      {currentView === 'trash' ? <section className="navigation-mode" aria-label="Corbeille">
        <div className="navigation-mode-header"><span>Corbeille</span><strong>{trashCount}</strong></div>
        <button className="empty-trash-button" type="button" onClick={onEmptyTrash} disabled={trashCount === 0}>Vider la corbeille</button>
        {simpleList(deletedDocuments, 'Documents supprimés', 'La corbeille est vide.', 'trash')}
      </section> : null}

      {isNavigationMode ? <>
        <section className="folder-section" aria-label="Dossiers virtuels">
          <div className="folder-section-header"><span>Dossiers</span><div className="folder-actions">
            <button className="collapse-all-folders" type="button" onClick={() => setExpandedFolderIds(new Set())} title="Tout replier" aria-label="Tout replier">▸</button>
            <button className="expand-all-folders" type="button" onClick={() => setExpandedFolderIds(new Set(folders.map((folder) => folder.id)))} title="Tout déplier" aria-label="Tout déplier">▾</button>
            <button type="button" onClick={() => onCreateFolder(null)} title="Nouveau dossier racine">+</button>
            {currentView === 'folder' && selectedFolderId !== null ? <button type="button" onClick={() => onCreateFolder(selectedFolderId)} title="Nouveau sous-dossier">+/</button> : null}
          </div></div>
          {folderRows.length === 0 ? <p className="folder-empty">Aucun dossier.</p> : <div className="folder-list">
            {folderRows.map((folder) => {
              const isSelected = props.branchSelected && currentView === 'folder' && selectedFolderId === folder.id;
              const isExpanded = expandedFolderIds.has(folder.id);
              const folderDocuments = isExpanded ? documentsByFolder.get(folder.id) ?? [] : [];
              const openFolderMenu = (event: MouseEvent<HTMLButtonElement>) => openMenu(event, { folder });
              const startRename = () => onEditFolder(folder.id);
              const commitRename = (name: string) => { onRenameFolder(folder.id, name); onEditFolder(null); };
              return <div className="folder-row" key={folder.id}>
                {editingFolderId === folder.id ? <input
                  className="folder-name-input" defaultValue={folder.name} autoFocus style={{ marginLeft: `${folder.depth * 18}px` }}
                  onBlur={(event) => commitRename(event.currentTarget.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { onEditFolder(null); } }}
                /> : <>
                  <button className="folder-toggle-button" type="button" style={{ marginLeft: `${folder.depth * 18}px` }} onClick={() => toggleFolder(folder.id)} onContextMenu={openFolderMenu} title={isExpanded ? 'Replier le dossier' : 'Déplier le dossier'} aria-label={isExpanded ? 'Replier le dossier' : 'Déplier le dossier'}>{isExpanded ? '▾' : '▸'}</button>
                  <button className={isSelected ? 'folder-button selected' : 'folder-button'} type="button" onClick={() => onViewChange('folder', folder.id)} onDoubleClick={startRename}
                    aria-haspopup="menu" onContextMenu={openFolderMenu} title="Double-clic pour renommer">
                    <span className="folder-label"><span className="folder-icon" aria-hidden="true" />{folder.name}</span><strong>{folderDocumentCounts[folder.id] ?? 0}</strong>
                  </button>
                </>}
                {folderDocuments.map((document) => <button
                  className={selectedDocumentId === document.id ? 'tree-document-button selected' : 'tree-document-button'} key={document.id} type="button"
                  onContextMenu={event => openMenu(event, { doc: document, view: 'folder' })}
                  style={{ marginLeft: `${28 + folder.depth * 18}px` }} onClick={() => onSelectDocument(document.id, 'folder', folder.id)}
                ><span className="document-icon" aria-hidden="true" />{markers(document)}<span className="tree-document-title">{displayTitle(document)}</span></button>)}
              </div>;
            })}
          </div>}
        </section>

        <section className="unfiled-tree-section" aria-label="Documents non classés">
          <div className="pseudo-folder-row">
            <button className="folder-toggle-button" type="button" onClick={() => setIsUnfiledExpanded((value) => !value)} title={isUnfiledExpanded ? 'Replier Non classés' : 'Déplier Non classés'} aria-label={isUnfiledExpanded ? 'Replier Non classés' : 'Déplier Non classés'}>{isUnfiledExpanded ? '▾' : '▸'}</button>
            <button className={props.branchSelected && currentView === 'unfiled' ? 'folder-button selected' : 'folder-button'} type="button" onClick={() => onViewChange('unfiled', null)}>
              <span className="folder-label"><span className="folder-icon" aria-hidden="true" />Non classés</span><strong>{unfiledCount}</strong>
            </button>
          </div>
          {isUnfiledExpanded ? <div className="tree-document-list">
            {unfiledDocuments.length === 0 ? <p className="folder-empty">Aucun document non classé.</p> : unfiledDocuments.map((document) => <button
              className={selectedDocumentId === document.id ? 'tree-document-button selected' : 'tree-document-button'} key={document.id} type="button"
              onContextMenu={event => openMenu(event, { doc: document, view: 'unfiled' })}
              onClick={() => onSelectDocument(document.id, 'unfiled', null)}
            ><span className="document-icon" aria-hidden="true" />{markers(document)}<span className="tree-document-title">{displayTitle(document)}</span></button>)}
          </div> : null}
        </section>
      </> : null}
    </div>
    {folderMenu && target && <div className="folder-context-menu" role="menu"
      aria-label={'folder' in target ? target.folder.name : displayTitle(target.doc)}
      style={{
        left: folderMenu.x < window.innerWidth / 2 ? folderMenu.x : undefined,
        right: folderMenu.x >= window.innerWidth / 2 ? window.innerWidth - folderMenu.x : undefined,
        top: folderMenu.y < window.innerHeight / 2 ? folderMenu.y : undefined,
        bottom: folderMenu.y >= window.innerHeight / 2 ? window.innerHeight - folderMenu.y : undefined,
      }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFolderMenu(null); }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          folderMenu.trigger.focus();
          setFolderMenu(null);
        }
      }}>
      {'folder' in target ? <>
        {menuButton('Renommer', () => onEditFolder(target.folder.id), true)}
        {menuButton('Supprimer', () => props.onDeleteFolder(target.folder))}
      </> : target.doc.deleted_at
        ? menuButton('Restaurer', () => props.onDocumentAction(target.doc, target.view, 'restore'), true)
        : <>
          {menuButton('Renommer', () => props.onDocumentAction(target.doc, target.view, 'rename'), true)}
          {target.doc.special_role !== 'todo' && menuButton('Mettre à la corbeille', () => props.onDocumentAction(target.doc, target.view, 'trash'))}
        </>}
    </div>}
  </aside>;
}
