import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import EditorPane from './components/EditorPane';
import MetadataPane from './components/MetadataPane';
import NavigationPane from './components/NavigationPane';
import StatusBar from './components/StatusBar';
import {
  createFolder,
  createDocument,
  emptyTrash,
  listDeletedDocuments,
  listFolders,
  listDocuments,
  renameFolder,
  restoreDocument,
  saveDocument,
  selectDocument,
  trashDocument,
} from './services/documents';
import { getErrorMessage, logRendererError } from './services/errors';
import type { DocumentStatus, Folder, TextDocument } from './types/document';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type ResizeTarget = 'left' | 'right';
type DocumentView = 'all' | 'unfiled' | 'folder' | 'trash';

const UNSAVED_CHANGES_MESSAGE =
  'Ce document contient des modifications non sauvegardees. Voulez-vous vraiment continuer sans sauvegarder ?';
const PANE_STORAGE_KEY = 'textotheque:pane-widths:v1';
const UNTITLED_FALLBACK = 'Sans titre';

interface PaneWidths {
  left: number;
  right: number;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  focusAfterCancel?: boolean;
  resolve: (confirmed: boolean) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function loadPaneWidths(): PaneWidths {
  const fallback = { left: 22, right: 24 };

  try {
    const stored = window.localStorage.getItem(PANE_STORAGE_KEY);
    if (!stored) {
      return fallback;
    }

    const parsed = JSON.parse(stored) as Partial<PaneWidths>;
    if (typeof parsed.left !== 'number' || typeof parsed.right !== 'number') {
      return fallback;
    }

    return {
      left: clamp(parsed.left, 18, 34),
      right: clamp(parsed.right, 18, 34),
    };
  } catch {
    return fallback;
  }
}

function titleForEditing(title: string): string {
  const trimmedTitle = title.trim();
  return trimmedTitle === '' || trimmedTitle === UNTITLED_FALLBACK ? '' : title;
}

export default function App() {
  const [documents, setDocuments] = useState<TextDocument[]>([]);
  const [deletedDocuments, setDeletedDocuments] = useState<TextDocument[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documentView, setDocumentView] = useState<DocumentView>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<TextDocument | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<DocumentStatus>('draft');
  const [favorite, setFavorite] = useState(false);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paneWidths, setPaneWidths] = useState<PaneWidths>(() => loadPaneWidths());
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const shellRef = useRef<HTMLElement | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    void refreshDocuments().catch((loadError: unknown) => {
      showOperationError('initial-load', loadError, 'Impossible de charger les documents et les dossiers.');
    });
  }, []);

  const characterCount = content.length;
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  );
  const currentDocuments = useMemo(() => {
    if (documentView === 'trash') {
      return deletedDocuments;
    }
    if (documentView === 'unfiled') {
      return documents.filter((document) => document.folder_id === null);
    }
    if (documentView === 'folder') {
      return selectedFolderId === null ? [] : documents.filter((document) => document.folder_id === selectedFolderId);
    }
    return documents;
  }, [deletedDocuments, documentView, documents, selectedFolderId]);
  const unfiledCount = useMemo(
    () => documents.filter((document) => document.folder_id === null).length,
    [documents]
  );
  const folderDocumentCounts = useMemo(
    () =>
      documents.reduce<Record<number, number>>((counts, document) => {
        if (document.folder_id !== null) {
          counts[document.folder_id] = (counts[document.folder_id] ?? 0) + 1;
        }
        return counts;
      }, {}),
    [documents]
  );
  const viewContextLabel = useMemo(() => {
    if (documentView === 'trash') {
      return 'Corbeille';
    }
    if (documentView === 'unfiled') {
      return 'Non classes';
    }
    if (documentView === 'folder') {
      return selectedFolder ? `Dossier: ${selectedFolder.name}` : 'Dossier';
    }
    return 'Tous les textes';
  }, [documentView, selectedFolder]);
  const visibleDocuments = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase('fr-FR');
    if (!normalizedSearch) {
      return currentDocuments;
    }

    return currentDocuments.filter((document) => {
      const titleValue = (document.title.trim() || UNTITLED_FALLBACK).toLocaleLowerCase('fr-FR');
      const contentValue = document.content.toLocaleLowerCase('fr-FR');
      return titleValue.includes(normalizedSearch) || contentValue.includes(normalizedSearch);
    });
  }, [currentDocuments, searchQuery]);
  const selectedDocumentIsDeleted = Boolean(selectedDocument?.deleted_at);
  const isDirty = Boolean(
    selectedDocument &&
      (title !== titleForEditing(selectedDocument.title) ||
        content !== selectedDocument.content ||
        notes !== selectedDocument.notes ||
        status !== selectedDocument.status ||
        folderId !== selectedDocument.folder_id ||
        favorite !== (selectedDocument.favorite === 1))
  );
  const displayedSaveState: SaveState =
    saveState === 'saving' || saveState === 'error' ? saveState : isDirty ? 'dirty' : saveState;

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    window.localStorage.setItem(PANE_STORAGE_KEY, JSON.stringify(paneWidths));
  }, [paneWidths]);

  const focusEditor = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('.content-editor')?.focus();
    });
  }, []);

  const focusSearch = useCallback(() => {
    window.requestAnimationFrame(() => {
      const searchInput = document.querySelector<HTMLInputElement>('.search-input-row input');
      searchInput?.focus();
      searchInput?.select();
    });
  }, []);

  const focusTitle = useCallback(() => {
    window.requestAnimationFrame(() => {
      const titleInput = document.querySelector<HTMLInputElement>('.title-input:not(:disabled)');
      titleInput?.focus();
      titleInput?.select();
    });
  }, []);

  function showOperationError(operation: string, operationError: unknown, fallback: string): void {
    logRendererError(operation, operationError);
    setError(getErrorMessage(operationError, fallback));
  }

  const confirmAction = useCallback(
    async (dialog: Omit<ConfirmDialogState, 'resolve'>) =>
      new Promise<boolean>((resolve) => {
        setConfirmDialog({ ...dialog, resolve });
      }),
    []
  );

  const confirmDiscardUnsavedChanges = useCallback(async () => {
    if (!isDirtyRef.current) {
      return true;
    }

    return confirmAction({
      title: 'Modifications non sauvegardees',
      message: UNSAVED_CHANGES_MESSAGE,
      confirmLabel: 'Continuer sans sauvegarder',
      danger: true,
      focusAfterCancel: true,
    });
  }, [confirmAction]);

  async function confirmMoveToTrash() {
    return new Promise<boolean>((resolve) => {
      setConfirmDialog({
        title: 'Deplacer vers la corbeille',
        message: 'Deplacer ce document vers la corbeille ? Vous pourrez le restaurer ensuite.',
        confirmLabel: 'Deplacer',
        danger: true,
        resolve,
      });
    });
  }

  async function confirmEmptyTrash(count: number) {
    return confirmAction({
      title: 'Vider la corbeille',
      message: `Vider la corbeille ? ${count} document(s) seront supprimes definitivement.`,
      confirmLabel: 'Vider',
      danger: true,
    });
  }

  function resolveConfirmation(confirmed: boolean) {
    const dialog = confirmDialog;
    const resolve = dialog?.resolve;
    setConfirmDialog(null);
    resolve?.(confirmed);

    if (!confirmed && dialog?.focusAfterCancel) {
      focusEditor();
    }
  }

  useEffect(() => {
    const removeCloseListener = window.textotheque.onCloseRequested(() => {
      void (async () => {
        try {
          if (await confirmDiscardUnsavedChanges()) {
            setError(null);
            await window.textotheque.approveClose();
          }
        } catch (closeError: unknown) {
          showOperationError('approve-close', closeError, "Impossible de fermer l'application.");
        }
      })();
    });

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      removeCloseListener();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [confirmDiscardUnsavedChanges]);

  function documentsForView(
    activeDocuments: TextDocument[],
    trashDocuments: TextDocument[],
    view: DocumentView,
    targetFolderId: number | null
  ) {
    if (view === 'trash') {
      return trashDocuments;
    }
    if (view === 'unfiled') {
      return activeDocuments.filter((document) => document.folder_id === null);
    }
    if (view === 'folder') {
      return targetFolderId === null ? [] : activeDocuments.filter((document) => document.folder_id === targetFolderId);
    }
    return activeDocuments;
  }

  async function refreshDocuments(
    nextSelectedId?: number,
    viewOverride: DocumentView = documentView,
    folderOverride: number | null = selectedFolderId
  ) {
    const [nextDocuments, nextDeletedDocuments, nextFolders] = await Promise.all([
      listDocuments(),
      listDeletedDocuments(),
      listFolders(),
    ]);
    setDocuments(nextDocuments);
    setDeletedDocuments(nextDeletedDocuments);
    setFolders(nextFolders);

    const nextCurrentDocuments = documentsForView(nextDocuments, nextDeletedDocuments, viewOverride, folderOverride);

    if (nextCurrentDocuments.length === 0) {
      setSelectedDocument(null);
      setTitle('');
      setContent('');
      setNotes('');
      setStatus('draft');
      setFavorite(false);
      setFolderId(null);
      setSaveState('idle');
      return;
    }

    const targetId = nextSelectedId ?? selectedDocument?.id ?? nextCurrentDocuments[0].id;
    const nextSelected = nextCurrentDocuments.find((document) => document.id === targetId) ?? nextCurrentDocuments[0];
    applyDocument(nextSelected);
  }

  function applyDocument(document: TextDocument) {
    setSelectedDocument(document);
    setTitle(titleForEditing(document.title));
    setContent(document.content);
    setNotes(document.notes);
    setStatus(document.status);
    setFavorite(document.favorite === 1);
    setFolderId(document.folder_id);
    setSaveState('saved');
    setError(null);
  }

  function markDirty() {
    if (selectedDocument) {
      setSaveState('dirty');
    }
  }

  async function handleChangeDocumentView(nextView: DocumentView, nextFolderId: number | null = null) {
    if (nextView === documentView && nextFolderId === selectedFolderId) {
      return;
    }

    if (!(await confirmDiscardUnsavedChanges())) {
      return;
    }

    setError(null);
    try {
      await refreshDocuments(undefined, nextView, nextFolderId);
      setDocumentView(nextView);
      setSelectedFolderId(nextFolderId);
    } catch (loadError: unknown) {
      showOperationError('change-view', loadError, 'Impossible de charger cette vue.');
    }
  }

  async function handleCreateDocument() {
    if (!(await confirmDiscardUnsavedChanges())) {
      return;
    }

    const targetFolderId =
      documentView === 'folder'
        ? selectedFolderId
        : selectedDocument && !selectedDocumentIsDeleted
          ? selectedDocument.folder_id
          : null;
    const targetView = targetFolderId === null ? 'all' : 'folder';

    setError(null);
    let document: TextDocument;
    try {
      document = await createDocument(targetFolderId);
    } catch (createError: unknown) {
      showOperationError('create-document', createError, 'Impossible de creer le document.');
      return;
    }

    try {
      await refreshDocuments(document.id, targetView, targetFolderId);
      setDocumentView(targetView);
      setSelectedFolderId(targetFolderId);
    } catch (loadError: unknown) {
      showOperationError('refresh-after-create-document', loadError, 'Document cree, mais actualisation impossible.');
      return;
    }
    focusEditor();
  }

  async function handleCreateFolder(parentId: number | null = null) {
    if (!(await confirmDiscardUnsavedChanges())) {
      return;
    }

    setError(null);
    let folder: Folder;
    try {
      folder = await createFolder(parentId);
    } catch (createError: unknown) {
      showOperationError('create-folder', createError, 'Impossible de creer le dossier.');
      return;
    }

    try {
      await refreshDocuments(undefined, 'folder', folder.id);
      setDocumentView('folder');
      setSelectedFolderId(folder.id);
    } catch (loadError: unknown) {
      showOperationError('refresh-after-create-folder', loadError, 'Dossier cree, mais actualisation impossible.');
    }
  }

  async function handleRenameFolder(id: number, name: string) {
    setError(null);
    try {
      await renameFolder(id, name);
    } catch (renameError: unknown) {
      showOperationError('rename-folder', renameError, 'Impossible de renommer le dossier.');
      return;
    }

    try {
      await refreshDocuments(selectedDocument?.id, documentView, selectedFolderId);
    } catch (loadError: unknown) {
      showOperationError('refresh-after-rename-folder', loadError, 'Dossier renomme, mais actualisation impossible.');
    }
  }

  async function handleSelectDocument(id: number, nextView?: DocumentView, nextFolderId?: number | null) {
    if (id === selectedDocument?.id) {
      if (nextView) {
        setDocumentView(nextView);
        setSelectedFolderId(nextFolderId ?? null);
      }
      return;
    }

    if (!(await confirmDiscardUnsavedChanges())) {
      return;
    }

    setError(null);
    let document: TextDocument | null;
    try {
      document = await selectDocument(id);
    } catch (loadError: unknown) {
      showOperationError('select-document', loadError, 'Impossible de charger le document.');
      return;
    }
    if (document) {
      if (nextView) {
        setDocumentView(nextView);
        setSelectedFolderId(nextFolderId ?? null);
      }
      applyDocument(document);
      try {
        await refreshDocuments(document.id, nextView ?? documentView, nextFolderId ?? selectedFolderId);
      } catch (loadError: unknown) {
        showOperationError('refresh-after-select-document', loadError, 'Document ouvert, mais actualisation impossible.');
      }
      focusEditor();
    }
  }

  async function handleSave() {
    if (!selectedDocument) {
      return;
    }

    setSaveState('saving');
    setError(null);

    let saved: TextDocument;
    try {
      saved = await saveDocument(selectedDocument.id, {
        title,
        content,
        notes,
        status,
        favorite,
        folder_id: folderId,
      });
    } catch (saveError: unknown) {
      setSaveState('error');
      showOperationError('save-document', saveError, 'Impossible de sauvegarder le document.');
      return;
    }

    let nextView = documentView;
    let nextFolderId = selectedFolderId;

    if (documentView === 'folder' || documentView === 'unfiled') {
      if (saved.folder_id === null) {
        nextView = 'unfiled';
        nextFolderId = null;
      } else {
        nextView = 'folder';
        nextFolderId = saved.folder_id;
      }
      setDocumentView(nextView);
      setSelectedFolderId(nextFolderId);
    }

    applyDocument(saved);
    setSaveState('saved');
    try {
      await refreshDocuments(saved.id, nextView, nextFolderId);
    } catch (loadError: unknown) {
      showOperationError('refresh-after-save-document', loadError, 'Document sauvegarde, mais actualisation impossible.');
    }
  }

  async function handleTrashCurrentDocument() {
    if (!selectedDocument || selectedDocumentIsDeleted) {
      return;
    }

    if (isDirty) {
      setError('Sauvegardez ou annulez les modifications avant de deplacer ce document vers la corbeille.');
      focusEditor();
      return;
    }

    if (!(await confirmMoveToTrash())) {
      return;
    }

    setError(null);
    try {
      await trashDocument(selectedDocument.id);
    } catch (trashError: unknown) {
      showOperationError('trash-document', trashError, 'Impossible de deplacer le document vers la corbeille.');
      return;
    }

    try {
      await refreshDocuments(undefined, 'all', null);
    } catch (loadError: unknown) {
      showOperationError('refresh-after-trash-document', loadError, 'Document deplace, mais actualisation impossible.');
    }
  }

  async function handleRestoreCurrentDocument() {
    if (!selectedDocument || !selectedDocumentIsDeleted) {
      return;
    }

    setError(null);
    let restored: TextDocument;
    try {
      restored = await restoreDocument(selectedDocument.id);
    } catch (restoreError: unknown) {
      showOperationError('restore-document', restoreError, 'Impossible de restaurer le document.');
      return;
    }

    try {
      await refreshDocuments(restored.id, 'all', null);
      setDocumentView('all');
      setSelectedFolderId(null);
    } catch (loadError: unknown) {
      showOperationError('refresh-after-restore-document', loadError, 'Document restaure, mais actualisation impossible.');
      return;
    }
    focusEditor();
  }

  async function handleEmptyTrash() {
    if (documentView !== 'trash' || deletedDocuments.length === 0) {
      return;
    }

    if (!(await confirmEmptyTrash(deletedDocuments.length))) {
      return;
    }

    setError(null);
    try {
      await emptyTrash();
    } catch (emptyError: unknown) {
      showOperationError('empty-trash', emptyError, 'Impossible de vider la corbeille.');
      return;
    }

    try {
      await refreshDocuments(undefined, 'trash', null);
    } catch (loadError: unknown) {
      showOperationError('refresh-after-empty-trash', loadError, 'Corbeille videe, mais actualisation impossible.');
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const usesCtrl = event.ctrlKey || event.metaKey;

      if (usesCtrl && key === 's') {
        event.preventDefault();
        if (selectedDocument && !selectedDocumentIsDeleted && saveState !== 'saving') {
          void handleSave();
        }
        return;
      }

      if (usesCtrl && key === 'n') {
        event.preventDefault();
        void handleCreateDocument();
        return;
      }

      if (usesCtrl && key === 'f') {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (event.key === 'Escape') {
        if (confirmDialog) {
          event.preventDefault();
          resolveConfirmation(false);
          return;
        }

        const activeElement = document.activeElement;
        if (
          activeElement instanceof HTMLInputElement &&
          activeElement.matches('.search-input-row input') &&
          searchQuery.trim().length > 0
        ) {
          event.preventDefault();
          setSearchQuery('');
        }
        return;
      }

      if (event.key === 'F2') {
        if (selectedDocument && !selectedDocumentIsDeleted) {
          event.preventDefault();
          focusTitle();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function startPaneResize(target: ResizeTarget, pointerDownEvent: ReactPointerEvent<HTMLButtonElement>) {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    pointerDownEvent.preventDefault();
    pointerDownEvent.currentTarget.setPointerCapture(pointerDownEvent.pointerId);

    const rect = shell.getBoundingClientRect();

    function handlePointerMove(pointerMoveEvent: globalThis.PointerEvent) {
      const totalWidth = rect.width;
      if (totalWidth <= 0) {
        return;
      }

      setPaneWidths((current) => {
        if (target === 'left') {
          const nextLeft = clamp(((pointerMoveEvent.clientX - rect.left) / totalWidth) * 100, 18, 34);
          const maxLeft = 64 - current.right;
          return { ...current, left: clamp(nextLeft, 18, maxLeft) };
        }

        const nextRight = clamp(((rect.right - pointerMoveEvent.clientX) / totalWidth) * 100, 18, 34);
        const maxRight = 64 - current.left;
        return { ...current, right: clamp(nextRight, 18, maxRight) };
      });
    }

    function stopResize() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  }

  return (
    <div className="app-root">
      <main
        className="app-shell"
        ref={shellRef}
        style={
          {
            '--left-pane-width': `${paneWidths.left}%`,
            '--right-pane-width': `${paneWidths.right}%`,
          } as CSSProperties
        }
      >
        <NavigationPane
          documents={visibleDocuments}
          allDocuments={documents}
          folders={folders}
          currentView={documentView}
          selectedFolderId={selectedFolderId}
          activeCount={documents.length}
          unfiledCount={unfiledCount}
          folderDocumentCounts={folderDocumentCounts}
          trashCount={deletedDocuments.length}
          totalDocuments={currentDocuments.length}
          searchQuery={searchQuery}
          selectedDocumentId={selectedDocument?.id ?? null}
          dirtyDocumentId={isDirty ? selectedDocument?.id ?? null : null}
          onViewChange={handleChangeDocumentView}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          onCreateDocument={handleCreateDocument}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onSelectDocument={handleSelectDocument}
          onEmptyTrash={handleEmptyTrash}
        />
        <button
          className="resize-handle"
          type="button"
          aria-label="Redimensionner le volet gauche"
          onPointerDown={(event) => startPaneResize('left', event)}
        />
        <EditorPane
          document={selectedDocument}
          title={title}
          content={content}
          saveState={displayedSaveState}
          isDirty={isDirty}
          error={error}
          isDeleted={selectedDocumentIsDeleted}
          onTitleChange={(value) => {
            setTitle(value);
            markDirty();
          }}
          onContentChange={(value) => {
            setContent(value);
            markDirty();
          }}
          onSave={handleSave}
          onTrash={handleTrashCurrentDocument}
          onRestore={handleRestoreCurrentDocument}
        />
        <button
          className="resize-handle"
          type="button"
          aria-label="Redimensionner le volet droit"
          onPointerDown={(event) => startPaneResize('right', event)}
        />
        <MetadataPane
          document={selectedDocument}
          folders={folders}
          notes={notes}
          status={status}
          favorite={favorite}
          folderId={folderId}
          isDeleted={selectedDocumentIsDeleted}
          characterCount={characterCount}
          wordCount={wordCount}
          onNotesChange={(value) => {
            setNotes(value);
            markDirty();
          }}
          onStatusChange={(value) => {
            setStatus(value);
            markDirty();
          }}
          onFavoriteChange={(value) => {
            setFavorite(value);
            markDirty();
          }}
          onFolderChange={(value) => {
            setFolderId(value);
            markDirty();
          }}
        />
      </main>
      <StatusBar
        totalDocuments={currentDocuments.length}
        visibleDocuments={visibleDocuments.length}
        searchQuery={searchQuery}
        currentView={documentView}
        contextLabel={viewContextLabel}
        trashCount={deletedDocuments.length}
        selectedDocument={selectedDocument}
        status={status}
        saveState={displayedSaveState}
        characterCount={characterCount}
        wordCount={wordCount}
        version={__APP_VERSION__}
      />
      {confirmDialog ? (
        <div className="confirm-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 id="confirm-title">{confirmDialog.title}</h2>
            <p>{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button className="secondary-button" type="button" onClick={() => resolveConfirmation(false)}>
                Annuler
              </button>
              <button
                className={confirmDialog.danger ? 'danger-button' : 'primary-button'}
                type="button"
                onClick={() => resolveConfirmation(true)}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
