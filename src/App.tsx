import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import EditorPane, { type EditorPosition } from './components/EditorPane';
import DocumentCatalog from './components/DocumentCatalog';
import MetadataPane from './components/MetadataPane';
import NavigationPane from './components/NavigationPane';
import StatusBar from './components/StatusBar';
import {
  createFolder,
  createDocument,
  emptyTrash,
  getDocument,
  getOrCreateSpecialDocument,
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
import {
  backupLibrary,
  chooseCreateLibrary,
  chooseOpenLibrary,
  createLibrary,
  getLibraryInfo,
  getLibraryStartupNotice,
  inspectLibrary,
  openLibrary,
} from './services/library';
import { exportTextDocument, setDocumentExportAvailable } from './services/text-export';
import { listDocumentCatalog } from './services/catalog';
import { searchDocuments } from './services/search';
import {
  createSavedSearch,
  deleteSavedSearch,
  getSavedSearch,
  listSavedSearches,
  renameSavedSearch,
  setSearchMenuState,
  updateSavedSearch,
} from './services/saved-searches';
import type { CatalogDocument, CatalogSortDirection, CatalogSortField, DocumentCatalogOptions } from './types/catalog';
import type { DocumentInput, DocumentStatus, Folder, TextDocument } from './types/document';
import type { LibraryInfo, LibraryInspection, LibraryMenuAction, LibraryOpenResult } from './types/library';
import type { TextExportDraft } from './types/text-export';
import type {
  DatePeriod,
  SearchDateFilter,
  SearchDocument,
  SearchFolderSelection,
  SearchMatchMode,
  SearchSortField,
  SearchTextField,
  SearchDocumentsOptions,
} from './types/search';
import type { SavedSearchDefinition, SavedSearchSummary, SearchMenuAction } from './types/saved-search';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type LibraryBackupState = 'idle' | 'saving' | 'success';
type LibraryOpenState = 'idle' | 'choosing' | 'opening';
type ResizeTarget = 'left' | 'right';
type DocumentView = 'navigation' | 'all' | 'unfiled' | 'folder' | 'trash';

const UNSAVED_CHANGES_MESSAGE =
  'Ce document contient des modifications non sauvegardees. Voulez-vous vraiment continuer sans sauvegarder ?';
const LEGACY_PANE_STORAGE_KEY = 'textotheque:pane-widths:v1';
const PANE_LAYOUT_STORAGE_KEY = 'textotheque:pane-layout:v2';
const EXPANDED_FOLDERS_STORAGE_KEY = 'textotheque:expanded-folders:v2';
const UNTITLED_FALLBACK = 'Sans titre';
const AUTOSAVE_DELAY_MS = 1500;
const SEARCH_DEBOUNCE_MS = 250;

function emptyDateFilter(): SearchDateFilter {
  return { period: 'all', from: null, to: null };
}

function isDateFilterActive(filter: SearchDateFilter): boolean {
  return filter.period !== 'all';
}

function validateDateRange(filter: SearchDateFilter): string | null {
  if (filter.period !== 'custom' || !filter.from || !filter.to) return null;
  return filter.from > filter.to ? 'La date de début doit précéder la date de fin.' : null;
}

interface DocumentSaveSnapshot {
  requestContext: number;
  documentId: number;
  libraryPath: string;
  persistedFolderId: number | null;
  input: DocumentInput;
}

interface PaneLayout {
  left: number;
  right: number;
  leftVisible: boolean;
  rightVisible: boolean;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  focusAfterCancel?: boolean;
  resolve: (confirmed: boolean) => void;
}

interface SavedSearchNameDialogState {
  mode: 'save-as' | 'rename';
  title: string;
  confirmLabel: string;
  value: string;
  submitting: boolean;
}

const SEARCH_FIELD_ORDER: SearchTextField[] = ['title', 'content', 'notes'];
const SEARCH_STATUS_ORDER: DocumentStatus[] = ['draft', 'active', 'to_review', 'final', 'archived'];

function normalizeSearchCriteria(criteria: SearchDocumentsOptions): SearchDocumentsOptions {
  const normalizeDate = (filter: SearchDateFilter): SearchDateFilter => filter.period === 'custom'
    ? { ...filter }
    : { period: filter.period, from: null, to: null };
  return {
    query: criteria.query.trim(),
    fields: SEARCH_FIELD_ORDER.filter((field) => criteria.fields.includes(field)),
    matchMode: criteria.matchMode,
    folderSelection: {
      folderIds: [...new Set(criteria.folderSelection.folderIds)].sort((left, right) => left - right),
      includeUnclassified: criteria.folderSelection.includeUnclassified,
    },
    statuses: SEARCH_STATUS_ORDER.filter((status) => criteria.statuses.includes(status)),
    favoriteOnly: criteria.favoriteOnly,
    created: normalizeDate(criteria.created),
    modified: normalizeDate(criteria.modified),
    sortBy: criteria.sortBy,
    direction: criteria.direction,
  };
}

function criteriaFromSavedSearch(definition: SavedSearchDefinition): SearchDocumentsOptions {
  return normalizeSearchCriteria(definition);
}

function searchCriteriaSignature(criteria: SearchDocumentsOptions): string {
  return JSON.stringify(normalizeSearchCriteria(criteria));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function loadPaneLayout(): PaneLayout {
  const fallback = { left: 22, right: 24, leftVisible: true, rightVisible: true };

  try {
    const storedLayout = window.localStorage.getItem(PANE_LAYOUT_STORAGE_KEY);
    if (storedLayout) {
      const parsed = JSON.parse(storedLayout) as Partial<PaneLayout>;
      if (
        typeof parsed.left === 'number' &&
        typeof parsed.right === 'number' &&
        typeof parsed.leftVisible === 'boolean' &&
        typeof parsed.rightVisible === 'boolean'
      ) {
        return {
          left: clamp(parsed.left, 8, 34),
          right: clamp(parsed.right, 8, 34),
          leftVisible: parsed.leftVisible,
          rightVisible: parsed.rightVisible,
        };
      }
    }

    const legacyWidths = window.localStorage.getItem(LEGACY_PANE_STORAGE_KEY);
    if (legacyWidths) {
      const parsed = JSON.parse(legacyWidths) as Partial<PaneLayout>;
      if (typeof parsed.left === 'number' && typeof parsed.right === 'number') {
        return {
          ...fallback,
          left: clamp(parsed.left, 8, 34),
          right: clamp(parsed.right, 8, 34),
        };
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function titleForEditing(title: string): string {
  const trimmedTitle = title.trim();
  return trimmedTitle === '' || trimmedTitle === UNTITLED_FALLBACK ? '' : title;
}

function sameDocumentInput(first: DocumentInput, second: DocumentInput): boolean {
  return first.title === second.title &&
    first.content === second.content &&
    first.notes === second.notes &&
    first.status === second.status &&
    first.favorite === second.favorite &&
    first.folder_id === second.folder_id;
}

export default function App() {
  const [documents, setDocuments] = useState<TextDocument[]>([]);
  const [catalogDocuments, setCatalogDocuments] = useState<CatalogDocument[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<DocumentCatalogOptions>({
    sortBy: 'updated_at',
    direction: 'desc',
  });
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [deletedDocuments, setDeletedDocuments] = useState<TextDocument[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documentView, setDocumentView] = useState<DocumentView>('navigation');
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
  const [editorPositions, setEditorPositions] = useState(() => new Map<number, EditorPosition>());
  const [libraryInfo, setLibraryInfo] = useState<LibraryInfo | null>(null);
  const [libraryBackupState, setLibraryBackupState] = useState<LibraryBackupState>('idle');
  const [libraryOpenState, setLibraryOpenState] = useState<LibraryOpenState>('idle');
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);
  const [paneLayout, setPaneLayout] = useState<PaneLayout>(() => loadPaneLayout());
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [savedSearchNameDialog, setSavedSearchNameDialog] = useState<SavedSearchNameDialogState | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearchSummary[]>([]);
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<number | null>(null);
  const [activeSavedSearchName, setActiveSavedSearchName] = useState<string | null>(null);
  const [savedSearchBaseline, setSavedSearchBaseline] = useState<SearchDocumentsOptions | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFields, setSearchFields] = useState<SearchTextField[]>(['title', 'content', 'notes']);
  const [searchMatchMode, setSearchMatchMode] = useState<SearchMatchMode>('all');
  const [searchFolderSelection, setSearchFolderSelection] = useState<SearchFolderSelection>({
    folderIds: [],
    includeUnclassified: false,
  });
  const [searchStatuses, setSearchStatuses] = useState<DocumentStatus[]>([]);
  const [searchFavoriteOnly, setSearchFavoriteOnly] = useState(false);
  const [createdFilter, setCreatedFilter] = useState<SearchDateFilter>(emptyDateFilter);
  const [modifiedFilter, setModifiedFilter] = useState<SearchDateFilter>(emptyDateFilter);
  const [searchResults, setSearchResults] = useState<SearchDocument[]>([]);
  const [searchResultsVisible, setSearchResultsVisible] = useState(false);
  const searchOrigin = useRef<{ documentId: number | null } | null>(null);
  const [advancedSearchExpanded, setAdvancedSearchExpanded] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchValidationMessage, setSearchValidationMessage] = useState<string | null>(null);
  const [searchSortBy, setSearchSortBy] = useState<SearchSortField>('relevance');
  const [searchDirection, setSearchDirection] = useState<'asc' | 'desc'>('asc');
  const shellRef = useRef<HTMLElement | null>(null);
  const isDirtyRef = useRef(false);
  const libraryOperationRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContextRef = useRef(0);
  const nextSaveRequestRef = useRef(0);
  const inFlightSaveRequestsRef = useRef(new Set<number>());
  const latestDraftRef = useRef<DocumentSaveSnapshot | null>(null);
  const latestTextExportRef = useRef<TextExportDraft | null>(null);
  const restoreHiddenNavigationAfterSearchRef = useRef(false);
  const catalogRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const activeLibraryPathRef = useRef<string | null>(null);

  useEffect(() => {
    void refreshDocuments().catch((loadError: unknown) => {
      showOperationError('initial-load', loadError, 'Impossible de charger les documents et les dossiers.');
    });
    void getLibraryInfo()
      .then(setLibraryInfo)
      .catch((loadError: unknown) => {
        showOperationError('load-library-info', loadError, 'Impossible de lire les informations de la bibliothèque.');
      });
    void getLibraryStartupNotice()
      .then((notice) => {
        if (notice) setLibraryNotice(notice);
      })
      .catch((loadError: unknown) => {
        logRendererError('load-library-startup-notice', loadError);
      });
  }, []);

  const characterCount = content.length;
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  );
  const navigationDocuments = useMemo(
    () => documents.filter((document) => document.special_role !== 'todo'),
    [documents]
  );
  const currentDocuments = useMemo(() => {
    if (documentView === 'trash') {
      return deletedDocuments;
    }
    if (documentView === 'unfiled') {
      return navigationDocuments.filter((document) => document.folder_id === null);
    }
    if (documentView === 'folder') {
      return selectedFolderId === null
        ? []
        : navigationDocuments.filter((document) => document.folder_id === selectedFolderId);
    }
    return documentView === 'all' ? documents : navigationDocuments;
  }, [deletedDocuments, documentView, documents, navigationDocuments, selectedFolderId]);
  const unfiledCount = useMemo(
    () => navigationDocuments.filter((document) => document.folder_id === null).length,
    [navigationDocuments]
  );
  const folderDocumentCounts = useMemo(
    () =>
      navigationDocuments.reduce<Record<number, number>>((counts, document) => {
        if (document.folder_id !== null) {
          counts[document.folder_id] = (counts[document.folder_id] ?? 0) + 1;
        }
        return counts;
      }, {}),
    [navigationDocuments]
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
    return documentView === 'all' ? 'Tous les textes' : 'Bibliothèque';
  }, [documentView, selectedFolder]);
  const selectedDocumentIsDeleted = Boolean(selectedDocument?.deleted_at);
  const selectedDocumentIsTodo = selectedDocument?.special_role === 'todo';
  const hasStructuredSearchFilters =
    searchFolderSelection.folderIds.length > 0 ||
    searchFolderSelection.includeUnclassified ||
    searchStatuses.length > 0 ||
    searchFavoriteOnly ||
    isDateFilterActive(createdFilter) ||
    isDateFilterActive(modifiedFilter);
  const hasActiveSearchCriteria = Boolean(searchQuery.trim() || hasStructuredSearchFilters);
  const currentSearchCriteria = useMemo<SearchDocumentsOptions>(() => normalizeSearchCriteria({
    query: searchQuery,
    fields: searchFields,
    matchMode: searchMatchMode,
    folderSelection: searchFolderSelection,
    statuses: searchStatuses,
    favoriteOnly: searchFavoriteOnly,
    created: createdFilter,
    modified: modifiedFilter,
    sortBy: searchSortBy,
    direction: searchDirection,
  }), [
    createdFilter,
    modifiedFilter,
    searchDirection,
    searchFavoriteOnly,
    searchFields,
    searchFolderSelection,
    searchMatchMode,
    searchQuery,
    searchSortBy,
    searchStatuses,
  ]);
  const savedSearchModified = activeSavedSearchId !== null && savedSearchBaseline !== null &&
    searchCriteriaSignature(currentSearchCriteria) !== searchCriteriaSignature(savedSearchBaseline);
  const savedSearchCanSave = !validateDateRange(createdFilter) && !validateDateRange(modifiedFilter) &&
    (!searchQuery.trim() || searchFields.length > 0) && (searchQuery.trim().length > 0 || searchSortBy !== 'relevance') &&
    (createdFilter.period !== 'custom' || Boolean(createdFilter.from || createdFilter.to)) &&
    (modifiedFilter.period !== 'custom' || Boolean(modifiedFilter.from || modifiedFilter.to));
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
    saveState === 'saving' || saveState === 'error'
      ? saveState
      : isDirty
        ? 'dirty'
        : saveState === 'dirty'
          ? 'saved'
          : saveState;

  latestDraftRef.current = selectedDocument && libraryInfo ? {
    requestContext: editorContextRef.current,
    documentId: selectedDocument.id,
    libraryPath: libraryInfo.path,
    persistedFolderId: selectedDocument.folder_id,
    input: { title, content, notes, status, favorite, folder_id: folderId },
  } : null;
  latestTextExportRef.current = selectedDocument ? { title, content } : null;

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    void setDocumentExportAvailable(Boolean(selectedDocument)).catch((availabilityError: unknown) => {
      logRendererError('set-document-export-available', availabilityError);
    });
  }, [selectedDocument]);

  useEffect(() => {
    window.localStorage.setItem(PANE_LAYOUT_STORAGE_KEY, JSON.stringify(paneLayout));
  }, [paneLayout]);

  useEffect(() => {
    const libraryPath = libraryInfo?.path ?? null;
    activeLibraryPathRef.current = libraryPath;
    setActiveSavedSearchId(null);
    setActiveSavedSearchName(null);
    setSavedSearchBaseline(null);
    if (!libraryPath) {
      setSavedSearches([]);
      return;
    }
    void listSavedSearches().then((items) => {
      if (activeLibraryPathRef.current === libraryPath) setSavedSearches(items);
    }).catch((loadError: unknown) => {
      if (activeLibraryPathRef.current === libraryPath) {
        showOperationError('list-saved-searches', loadError, 'Impossible de charger les recherches enregistrées.');
      }
    });
  }, [libraryInfo?.path]);

  useEffect(() => {
    void setSearchMenuState({
      activeSavedSearchId,
      modified: savedSearchModified,
      canSave: savedSearchCanSave,
    }).catch((menuError: unknown) => logRendererError('set-search-menu-state', menuError));
  }, [activeSavedSearchId, savedSearchCanSave, savedSearchModified]);

  useEffect(() => {
    if (!searchResultsVisible) return;
    const requestId = ++searchRequestRef.current;
    const hasText = searchQuery.trim().length > 0;
    if (hasText && searchFields.length === 0) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchValidationMessage('Choisissez au moins une zone de recherche.');
      return;
    }
    const dateValidationMessage = validateDateRange(createdFilter) ?? validateDateRange(modifiedFilter);
    if (dateValidationMessage) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchValidationMessage(dateValidationMessage);
      return;
    }

    setSearchValidationMessage(null);
    setSearchLoading(true);
    const naturalSortBy: CatalogSortField = isDateFilterActive(modifiedFilter)
      ? 'updated_at'
      : isDateFilterActive(createdFilter)
        ? 'created_at'
        : 'updated_at';
    const timer = window.setTimeout(() => {
      void searchDocuments({
        query: searchQuery,
        fields: searchFields,
        matchMode: searchMatchMode,
        folderSelection: searchFolderSelection,
        statuses: searchStatuses,
        favoriteOnly: searchFavoriteOnly,
        created: createdFilter,
        modified: modifiedFilter,
        sortBy: hasText ? searchSortBy : searchSortBy === 'relevance' ? naturalSortBy : searchSortBy,
        direction: hasText ? searchDirection : searchSortBy === 'relevance' ? 'desc' : searchDirection,
      }).then((rows) => {
        if (requestId !== searchRequestRef.current) return;
        setSearchResults(rows);
        setError(null);
      }).catch((searchError: unknown) => {
        if (requestId !== searchRequestRef.current) return;
        showOperationError('search-documents', searchError, 'Impossible d’effectuer la recherche.');
      }).finally(() => {
        if (requestId === searchRequestRef.current) setSearchLoading(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    createdFilter,
    modifiedFilter,
    searchDirection,
    searchFavoriteOnly,
    searchFields,
    searchFolderSelection,
    searchMatchMode,
    searchQuery,
    searchResultsVisible,
    searchSortBy,
    searchStatuses,
  ]);

  const focusEditor = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('.content-editor')?.focus({ preventScroll: true });
    });
  }, []);

  const focusSearch = useCallback(() => {
    setPaneLayout((current) => {
      if (current.leftVisible) {
        return current;
      }
      restoreHiddenNavigationAfterSearchRef.current = true;
      return { ...current, leftVisible: true };
    });
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
      return activeDocuments.filter((document) => document.special_role !== 'todo' && document.folder_id === null);
    }
    if (view === 'folder') {
      return targetFolderId === null
        ? []
        : activeDocuments.filter(
            (document) => document.special_role !== 'todo' && document.folder_id === targetFolderId
          );
    }
    return view === 'all'
      ? activeDocuments
      : activeDocuments.filter((document) => document.special_role !== 'todo');
  }

  function clearAutosaveTimer(): void {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  function invalidateEditorContext(): void {
    clearAutosaveTimer();
    editorContextRef.current += 1;
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
      invalidateEditorContext();
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
    invalidateEditorContext();
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

  async function refreshCatalog(options: DocumentCatalogOptions = catalogOptions): Promise<void> {
    const requestId = ++catalogRequestRef.current;
    setCatalogLoading(true);
    try {
      const rows = await listDocumentCatalog(options);
      if (requestId !== catalogRequestRef.current) return;
      setCatalogDocuments(rows);
      setError(null);
    } catch (catalogError: unknown) {
      if (requestId !== catalogRequestRef.current) return;
      showOperationError('load-document-catalog', catalogError, 'Impossible de charger le catalogue.');
    } finally {
      if (requestId === catalogRequestRef.current) setCatalogLoading(false);
    }
  }

  function hideSearchResults(): void {
    searchRequestRef.current += 1;
    searchOrigin.current = null;
    setSearchResultsVisible(false);
    setSearchLoading(false);
  }

  function handleCatalogSort(sortBy: CatalogSortField): void {
    if (searchResultsVisible) {
      setSearchSortBy(sortBy);
      setSearchDirection(searchSortBy === sortBy && searchDirection === 'asc' ? 'desc' : 'asc');
      return;
    }
    const nextOptions: DocumentCatalogOptions = {
      sortBy,
      direction: catalogOptions.sortBy === sortBy && catalogOptions.direction === 'asc' ? 'desc' : 'asc',
    };
    setCatalogOptions(nextOptions);
    void refreshCatalog(nextOptions);
  }

  async function handleChangeDocumentView(nextView: DocumentView, nextFolderId: number | null = null) {
    clearSavedSearchAssociation();
    if (nextView === 'all') {
      if (catalogVisible && documentView === 'all') return;
      hideSearchResults();
      setDocumentView('all');
      setSelectedFolderId(null);
      setCatalogVisible(true);
      setError(null);
      void refreshCatalog(catalogOptions);
      return;
    }

    if (nextView === documentView && nextFolderId === selectedFolderId && !catalogVisible && !searchResultsVisible) {
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
      setCatalogVisible(false);
      hideSearchResults();
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
    const targetView = targetFolderId === null ? 'unfiled' : 'folder';

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
      setCatalogVisible(false);
      hideSearchResults();
    } catch (loadError: unknown) {
      showOperationError('refresh-after-create-document', loadError, 'Document cree, mais actualisation impossible.');
      return;
    }
    focusEditor();
  }

  async function handleOpenTodo() {
    if (selectedDocumentIsTodo) {
      setCatalogVisible(false);
      hideSearchResults();
      return;
    }
    if (!(await confirmDiscardUnsavedChanges())) {
      return;
    }

    setError(null);
    let todo: TextDocument;
    try {
      todo = await getOrCreateSpecialDocument('todo');
    } catch (todoError: unknown) {
      showOperationError('open-special-todo', todoError, 'Impossible d’ouvrir le TODO.');
      return;
    }

    try {
      const [nextDocuments, nextDeletedDocuments, nextFolders] = await Promise.all([
        listDocuments(),
        listDeletedDocuments(),
        listFolders(),
      ]);
      setDocuments(nextDocuments);
      setDeletedDocuments(nextDeletedDocuments);
      setFolders(nextFolders);
      applyDocument(nextDocuments.find((document) => document.id === todo.id) ?? todo);
      setDocumentView('all');
      setSelectedFolderId(null);
      setCatalogVisible(false);
      hideSearchResults();
      focusEditor();
    } catch (loadError: unknown) {
      showOperationError('refresh-after-open-special-todo', loadError, 'TODO ouvert, mais actualisation impossible.');
    }
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
      showOperationError(
        'create-folder',
        createError,
        parentId === null ? 'Impossible de creer le dossier.' : 'Impossible de creer le sous-dossier.'
      );
      return;
    }

    try {
      await refreshDocuments(undefined, 'folder', folder.id);
      setDocumentView('folder');
      setSelectedFolderId(folder.id);
      setCatalogVisible(false);
      hideSearchResults();
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

  async function handleSelectDocument(
    id: number,
    nextView?: DocumentView,
    nextFolderId?: number | null
  ): Promise<boolean> {
    if (id === selectedDocument?.id) {
      if (nextView) {
        setDocumentView(nextView);
        setSelectedFolderId(nextFolderId ?? null);
      }
      setCatalogVisible(false);
      hideSearchResults();
      return true;
    }

    if (!(await confirmDiscardUnsavedChanges())) {
      return false;
    }

    setError(null);
    let document: TextDocument | null;
    try {
      document = await selectDocument(id);
    } catch (loadError: unknown) {
      showOperationError('select-document', loadError, 'Impossible de charger le document.');
      return false;
    }
    if (document) {
      if (nextView) {
        setDocumentView(nextView);
        setSelectedFolderId(nextFolderId ?? null);
      }
      setCatalogVisible(false);
      hideSearchResults();
      applyDocument(document);
      try {
        await refreshDocuments(document.id, nextView ?? documentView, nextFolderId ?? selectedFolderId);
      } catch (loadError: unknown) {
        showOperationError('refresh-after-select-document', loadError, 'Document ouvert, mais actualisation impossible.');
      }
      focusEditor();
      return true;
    }
    return false;
  }

  function captureCurrentSaveSnapshot(): DocumentSaveSnapshot | null {
    const draft = latestDraftRef.current;
    return draft ? { ...draft, input: { ...draft.input } } : null;
  }

  function snapshotStillTargetsCurrentContext(snapshot: DocumentSaveSnapshot): boolean {
    return editorContextRef.current === snapshot.requestContext &&
      latestDraftRef.current?.documentId === snapshot.documentId &&
      latestDraftRef.current.libraryPath === snapshot.libraryPath;
  }

  async function persistCurrentDocument(snapshot: DocumentSaveSnapshot) {
    const requestId = ++nextSaveRequestRef.current;
    inFlightSaveRequestsRef.current.add(requestId);
    setSaveState('saving');
    setError(null);

    let saved: TextDocument;
    try {
      saved = await saveDocument(snapshot.documentId, snapshot.input, snapshot.libraryPath);
    } catch (saveError: unknown) {
      inFlightSaveRequestsRef.current.delete(requestId);
      if (!snapshotStillTargetsCurrentContext(snapshot)) return;
      const newerRequestIsRunning = [...inFlightSaveRequestsRef.current].some((candidate) => candidate > requestId);
      if (newerRequestIsRunning) return;
      setSaveState('error');
      showOperationError(
        'save-document',
        saveError,
        snapshot.input.folder_id !== snapshot.persistedFolderId
          ? 'Impossible d affecter ce document a ce dossier.'
          : 'Impossible de sauvegarder le document.'
      );
      return;
    }

    inFlightSaveRequestsRef.current.delete(requestId);
    if (!snapshotStillTargetsCurrentContext(snapshot)) return;

    setSelectedDocument(saved);
    setDocuments((current) => current.map((document) => document.id === saved.id ? saved : document));
    setError(null);

    const currentDraft = latestDraftRef.current;
    const currentMatchesSnapshot = Boolean(currentDraft && sameDocumentInput(currentDraft.input, snapshot.input));
    const newerRequestIsRunning = [...inFlightSaveRequestsRef.current].some((candidate) => candidate > requestId);

    if (currentMatchesSnapshot && (documentView === 'folder' || documentView === 'unfiled')) {
      if (saved.folder_id === null) {
        setDocumentView('unfiled');
        setSelectedFolderId(null);
      } else {
        setDocumentView('folder');
        setSelectedFolderId(saved.folder_id);
      }
    }

    setSaveState(newerRequestIsRunning ? 'saving' : currentMatchesSnapshot ? 'saved' : 'dirty');
  }

  async function handleSave() {
    clearAutosaveTimer();
    const snapshot = captureCurrentSaveSnapshot();
    if (!snapshot || selectedDocumentIsDeleted) return;
    await persistCurrentDocument(snapshot);
  }

  useEffect(() => {
    clearAutosaveTimer();
    if (!isDirty || !selectedDocument || selectedDocumentIsDeleted || !libraryInfo || saveState === 'saving' || saveState === 'error') {
      return;
    }

    const snapshot = captureCurrentSaveSnapshot();
    if (!snapshot) return;
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistCurrentDocument(snapshot);
    }, AUTOSAVE_DELAY_MS);

    return clearAutosaveTimer;
  }, [content, favorite, folderId, isDirty, libraryInfo?.path, notes, saveState, selectedDocument?.id, selectedDocumentIsDeleted, status, title]);

  async function handleBackupLibrary() {
    if (isDirtyRef.current) {
      setError('Sauvegardez le document avant de créer une copie de la bibliothèque.');
      return;
    }
    setError(null);
    setLibraryNotice(null);
    setLibraryBackupState('saving');
    try {
      const result = await backupLibrary();
      if (result.canceled) {
        setLibraryBackupState('idle');
        return;
      }
      if (result.error === 'same-source') {
        setLibraryBackupState('idle');
        setError('La sauvegarde doit utiliser un fichier différent de la bibliothèque courante.');
        return;
      }
      setLibraryBackupState('success');
      setLibraryNotice(`Sauvegarde créée : ${result.fileName ?? 'copie SQLite'}.`);
    } catch (backupError: unknown) {
      setLibraryBackupState('idle');
      showOperationError('backup-library', backupError, 'Impossible de créer la sauvegarde de la bibliothèque.');
    }
  }

  async function handleExportTextDocument(snapshot: TextExportDraft) {
    try {
      const result = await exportTextDocument(snapshot);
      if (result.canceled) return;
      setError(null);
      setLibraryNotice(`Export texte créé : ${result.fileName ?? 'fichier texte'}.`);
    } catch (exportError: unknown) {
      showOperationError('export-text-document', exportError, 'Impossible d’exporter ce document.');
    }
  }

  function migrationMessage(inspection: LibraryInspection): string {
    if (inspection.applicationId === 0 && inspection.userVersion === libraryInfo?.userVersion) {
      return 'Cette ancienne bibliothèque Textothèque doit être adoptée avant ouverture. Une copie de sauvegarde sera créée automatiquement.';
    }
    return 'Cette bibliothèque utilise un ancien format Textothèque et doit être mise à jour avant ouverture. Une copie de sauvegarde sera créée automatiquement.';
  }

  async function confirmLibraryMigration(inspection: LibraryInspection): Promise<boolean> {
    return confirmAction({
      title: inspection.applicationId === 0 ? 'Ancienne bibliothèque Textothèque' : 'Migration nécessaire',
      message: migrationMessage(inspection),
      confirmLabel: 'Migrer et ouvrir',
    });
  }

  function showLibraryOpenResultError(result: LibraryOpenResult): void {
    const messages: Partial<Record<LibraryOpenResult['status'], string>> = {
      'too-new': 'Cette bibliothèque est plus récente que cette version de Textothèque.',
      foreign: 'Cette bibliothèque appartient à une autre application.',
      invalid: 'Ce fichier ne contient pas une bibliothèque Textothèque valide.',
      'backup-failed': 'Impossible de créer la sauvegarde nécessaire à la migration.',
      'migration-failed': 'Impossible de migrer cette bibliothèque.',
      'open-failed': 'Impossible d’ouvrir cette bibliothèque.',
    };
    setError(messages[result.status] ?? 'Impossible d’ouvrir cette bibliothèque.');
  }

  function clearWorkspaceForLibrarySwitch(nextLibrary: LibraryInfo): void {
    setEditorPositions(new Map());
    invalidateEditorContext();
    setDocuments([]);
    setCatalogDocuments([]);
    setCatalogVisible(false);
    searchRequestRef.current += 1;
    setSearchResults([]);
    searchOrigin.current = null;
    setSearchResultsVisible(false);
    setSearchLoading(false);
    setSearchValidationMessage(null);
    setAdvancedSearchExpanded(false);
    clearSavedSearchAssociation();
    setSavedSearches([]);
    setSavedSearchNameDialog(null);
    setDeletedDocuments([]);
    setFolders([]);
    setDocumentView('navigation');
    setSelectedFolderId(null);
    setSelectedDocument(null);
    setTitle('');
    setContent('');
    setNotes('');
    setStatus('draft');
    setFavorite(false);
    setFolderId(null);
    setSaveState('idle');
    setSearchQuery('');
    setSearchFields(['title', 'content', 'notes']);
    setSearchMatchMode('all');
    setSearchFolderSelection({ folderIds: [], includeUnclassified: false });
    setSearchStatuses([]);
    setSearchFavoriteOnly(false);
    setCreatedFilter(emptyDateFilter());
    setModifiedFilter(emptyDateFilter());
    setSearchSortBy('relevance');
    setSearchDirection('asc');
    restoreHiddenNavigationAfterSearchRef.current = false;
    window.localStorage.removeItem(EXPANDED_FOLDERS_STORAGE_KEY);
    setLibraryInfo(nextLibrary);
  }

  async function finishLibrarySwitch(result: LibraryOpenResult): Promise<void> {
    if (!result.library) {
      throw new Error('La bibliothèque ouverte ne fournit pas ses informations.');
    }
    clearWorkspaceForLibrarySwitch(result.library);
    const [nextDocuments, nextDeletedDocuments, nextFolders] = await Promise.all([
      listDocuments(),
      listDeletedDocuments(),
      listFolders(),
    ]);
    setDocuments(nextDocuments);
    setDeletedDocuments(nextDeletedDocuments);
    setFolders(nextFolders);
    setLibraryNotice(`Bibliothèque ouverte : ${result.library.fileName}.`);
  }

  async function handleOpenLibrary(knownPath?: string) {
    if (libraryOperationRef.current) return;
    if (!(await confirmDiscardUnsavedChanges())) {
      return;
    }

    libraryOperationRef.current = true;
    setError(null);
    setLibraryNotice(null);
    setLibraryOpenState('choosing');
    let selection: LibraryOpenResult;
    try {
      selection = knownPath ? await inspectLibrary(knownPath) : await chooseOpenLibrary();
    } catch (openError: unknown) {
      setLibraryOpenState('idle');
      libraryOperationRef.current = false;
      showOperationError('choose-library', openError, 'Impossible d’ouvrir le sélecteur de bibliothèque.');
      return;
    }

    if (selection.status === 'canceled') {
      setLibraryOpenState('idle');
      libraryOperationRef.current = false;
      return;
    }
    if (selection.status === 'same') {
      setLibraryOpenState('idle');
      libraryOperationRef.current = false;
      setLibraryNotice('Cette bibliothèque est déjà ouverte.');
      return;
    }
    if (selection.status === 'too-new' || selection.status === 'foreign' || selection.status === 'invalid') {
      setLibraryOpenState('idle');
      libraryOperationRef.current = false;
      showLibraryOpenResultError(selection);
      return;
    }

    let migrationApproved = false;
    if (selection.status === 'needs-migration') {
      setLibraryOpenState('idle');
      if (!selection.inspection || !(await confirmLibraryMigration(selection.inspection))) {
        libraryOperationRef.current = false;
        return;
      }
      migrationApproved = true;
    }

    setLibraryOpenState('opening');
    try {
      let result = await openLibrary(selection.inspection!.path, migrationApproved);
      if (result.status === 'needs-migration' && !migrationApproved && result.inspection) {
        setLibraryOpenState('idle');
        if (!(await confirmLibraryMigration(result.inspection))) {
          return;
        }
        setLibraryOpenState('opening');
        result = await openLibrary(result.inspection.path, true);
      }
      if (result.status === 'same') {
        setLibraryNotice('Cette bibliothèque est déjà ouverte.');
        return;
      }
      if (result.status !== 'opened') {
        showLibraryOpenResultError(result);
        return;
      }
      await finishLibrarySwitch(result);
    } catch (openError: unknown) {
      showOperationError('open-library', openError, 'Impossible d’ouvrir cette bibliothèque.');
    } finally {
      setLibraryOpenState('idle');
      libraryOperationRef.current = false;
    }
  }

  async function handleNewLibrary() {
    if (libraryOperationRef.current) return;
    if (!(await confirmDiscardUnsavedChanges())) return;

    libraryOperationRef.current = true;
    setError(null);
    setLibraryNotice(null);
    setLibraryOpenState('choosing');
    try {
      const selection = await chooseCreateLibrary();
      if (selection.status === 'canceled') return;
      if (selection.status === 'exists' || !selection.path) {
        setError('Ce fichier existe déjà. Utilisez « Ouvrir une bibliothèque… » pour travailler avec cette bibliothèque.');
        return;
      }
      setLibraryOpenState('opening');
      const result = await createLibrary(selection.path);
      if (result.status === 'exists') {
        setError('Ce fichier existe déjà. Utilisez « Ouvrir une bibliothèque… » pour travailler avec cette bibliothèque.');
        return;
      }
      if (result.status !== 'created' || !result.library) {
        setError('Impossible de créer cette bibliothèque.');
        return;
      }
      await finishLibrarySwitch({ status: 'opened', inspection: null, library: result.library, backupPath: null });
      setLibraryNotice(`Bibliothèque créée : ${result.library.fileName}.`);
    } catch (createError: unknown) {
      showOperationError('create-library', createError, 'Impossible de créer cette bibliothèque.');
    } finally {
      setLibraryOpenState('idle');
      libraryOperationRef.current = false;
    }
  }

  useEffect(() => window.textotheque.onLibraryMenuAction((menuAction: LibraryMenuAction) => {
    if (menuAction.action === 'new') void handleNewLibrary();
    if (menuAction.action === 'open') void handleOpenLibrary();
    if (menuAction.action === 'known') void handleOpenLibrary(menuAction.path);
    if (menuAction.action === 'backup') void handleBackupLibrary();
  }));

  useEffect(() => window.textotheque.onFileMenuAction((menuAction) => {
    if (menuAction.action === 'open-todo') {
      void handleOpenTodo();
      return;
    }
    const snapshot = latestTextExportRef.current;
    if (snapshot) void handleExportTextDocument({ ...snapshot });
  }));

  useEffect(() => window.textotheque.onSearchMenuAction((menuAction: SearchMenuAction) => {
    if (menuAction.action === 'focus') focusSearch();
    if (menuAction.action === 'advanced') showAdvancedSearch();
    if (menuAction.action === 'save-as') showSaveSavedSearchDialog();
    if (menuAction.action === 'update') void handleUpdateSavedSearch();
    if (menuAction.action === 'rename') showRenameSavedSearchDialog();
    if (menuAction.action === 'delete') void handleDeleteSavedSearch();
    if (menuAction.action === 'open') void handleOpenSavedSearch(menuAction.id);
  }));

  async function handleTrashCurrentDocument() {
    if (!selectedDocument || selectedDocumentIsDeleted) {
      return;
    }
    if (selectedDocumentIsTodo) {
      setError('Le TODO est un document permanent et ne peut pas être placé dans la corbeille.');
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
      setCatalogVisible(false);
      hideSearchResults();
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

  function clearSearchAndReturnToNavigation() {
    clearSavedSearchAssociation();
    hideSearchResults();
    setSearchQuery('');
    setSearchFolderSelection({ folderIds: [], includeUnclassified: false });
    setSearchStatuses([]);
    setSearchFavoriteOnly(false);
    setCreatedFilter(emptyDateFilter());
    setModifiedFilter(emptyDateFilter());
    setSearchResults([]);
    setSearchValidationMessage(null);
    setAdvancedSearchExpanded(false);
    setCatalogVisible(false);
    if (!selectedDocument || selectedDocument.deleted_at) {
      setDocumentView('navigation');
      setSelectedFolderId(null);
    } else if (selectedDocument.folder_id === null) {
      setDocumentView('unfiled');
      setSelectedFolderId(null);
    } else {
      setDocumentView('folder');
      setSelectedFolderId(selectedDocument.folder_id);
    }

    restoreNavigationAfterSearch();
  }

  function restoreNavigationAfterSearch(): void {
    if (restoreHiddenNavigationAfterSearchRef.current) {
      restoreHiddenNavigationAfterSearchRef.current = false;
      setPaneLayout((current) => ({ ...current, leftVisible: false }));
    }
  }

  function naturalStructuredSort(
    created: SearchDateFilter = createdFilter,
    modified: SearchDateFilter = modifiedFilter
  ): CatalogSortField {
    if (isDateFilterActive(modified)) return 'updated_at';
    if (isDateFilterActive(created)) return 'created_at';
    return 'updated_at';
  }

  function activateStructuredSearch(): void {
    if (!searchResultsVisible) {
      searchOrigin.current = { documentId: catalogVisible ? null : selectedDocument?.id ?? null };
    }
    setSearchResultsVisible(true);
    setAdvancedSearchExpanded(true);
    setCatalogVisible(false);
  }

  function resetSortForCriteria(created = createdFilter, modified = modifiedFilter): void {
    if (searchQuery.trim()) return;
    setSearchSortBy(naturalStructuredSort(created, modified));
    setSearchDirection('desc');
  }

  function clearSavedSearchAssociation(): void {
    setActiveSavedSearchId(null);
    setActiveSavedSearchName(null);
    setSavedSearchBaseline(null);
  }

  async function refreshSavedSearchList(expectedLibraryPath: string): Promise<void> {
    const items = await listSavedSearches();
    if (activeLibraryPathRef.current === expectedLibraryPath) setSavedSearches(items);
  }

  function applySavedSearchDefinition(definition: SavedSearchDefinition): void {
    const criteria = criteriaFromSavedSearch(definition);
    searchRequestRef.current += 1;
    setSearchQuery(criteria.query);
    setSearchFields(criteria.fields);
    setSearchMatchMode(criteria.matchMode);
    setSearchFolderSelection(criteria.folderSelection);
    setSearchStatuses(criteria.statuses);
    setSearchFavoriteOnly(criteria.favoriteOnly);
    setCreatedFilter(criteria.created);
    setModifiedFilter(criteria.modified);
    setSearchSortBy(criteria.sortBy);
    setSearchDirection(criteria.direction);
    setSearchValidationMessage(null);
    activateStructuredSearch();
    setActiveSavedSearchId(definition.id);
    setActiveSavedSearchName(definition.name);
    setSavedSearchBaseline(criteria);
  }

  async function handleOpenSavedSearch(id: number): Promise<void> {
    const expectedLibraryPath = activeLibraryPathRef.current;
    if (!expectedLibraryPath) return;
    try {
      const definition = await getSavedSearch(id);
      if (activeLibraryPathRef.current !== expectedLibraryPath) return;
      if (!definition) {
        setError('Cette recherche enregistrée est introuvable.');
        await refreshSavedSearchList(expectedLibraryPath);
        return;
      }
      setError(null);
      applySavedSearchDefinition(definition);
    } catch (loadError: unknown) {
      if (activeLibraryPathRef.current === expectedLibraryPath) {
        showOperationError('open-saved-search', loadError, 'Impossible de charger cette recherche enregistrée.');
      }
    }
  }

  function showSaveSavedSearchDialog(): void {
    if (!savedSearchCanSave) {
      setError('Corrigez les critères de recherche avant de les enregistrer.');
      return;
    }
    setSavedSearchNameDialog({
      mode: 'save-as',
      title: activeSavedSearchId === null ? 'Enregistrer la recherche' : 'Enregistrer la recherche sous',
      confirmLabel: 'Enregistrer',
      value: activeSavedSearchId === null ? '' : `${activeSavedSearchName ?? 'Recherche'} — copie`,
      submitting: false,
    });
  }

  function showRenameSavedSearchDialog(): void {
    if (activeSavedSearchId === null || !activeSavedSearchName) return;
    setSavedSearchNameDialog({
      mode: 'rename',
      title: 'Renommer la recherche',
      confirmLabel: 'Renommer',
      value: activeSavedSearchName,
      submitting: false,
    });
  }

  async function submitSavedSearchNameDialog(): Promise<void> {
    const dialog = savedSearchNameDialog;
    const expectedLibraryPath = activeLibraryPathRef.current;
    const name = dialog?.value.trim() ?? '';
    if (!dialog || !expectedLibraryPath || dialog.submitting) return;
    if (name.length < 1 || name.length > 120) {
      setError('Le nom de la recherche doit contenir entre 1 et 120 caractères.');
      return;
    }
    setSavedSearchNameDialog({ ...dialog, submitting: true });
    try {
      const definition = dialog.mode === 'save-as'
        ? await createSavedSearch({ ...currentSearchCriteria, name }, expectedLibraryPath)
        : activeSavedSearchId === null
          ? null
          : await renameSavedSearch(activeSavedSearchId, name, expectedLibraryPath);
      if (activeLibraryPathRef.current !== expectedLibraryPath || !definition) return;
      await refreshSavedSearchList(expectedLibraryPath);
      setActiveSavedSearchId(definition.id);
      setActiveSavedSearchName(definition.name);
      setSavedSearchBaseline(criteriaFromSavedSearch(definition));
      setSavedSearchNameDialog(null);
      setError(null);
    } catch (saveError: unknown) {
      if (activeLibraryPathRef.current === expectedLibraryPath) {
        setSavedSearchNameDialog((current) => current ? { ...current, submitting: false } : null);
        showOperationError(
          dialog.mode === 'save-as' ? 'create-saved-search' : 'rename-saved-search',
          saveError,
          dialog.mode === 'save-as'
            ? 'Impossible d’enregistrer cette recherche. Vérifiez que son nom est unique.'
            : 'Impossible de renommer cette recherche. Vérifiez que son nom est unique.'
        );
      }
    }
  }

  async function handleUpdateSavedSearch(): Promise<void> {
    const id = activeSavedSearchId;
    const expectedLibraryPath = activeLibraryPathRef.current;
    if (id === null || !expectedLibraryPath || !savedSearchModified || !savedSearchCanSave) return;
    try {
      const definition = await updateSavedSearch(id, currentSearchCriteria, expectedLibraryPath);
      if (activeLibraryPathRef.current !== expectedLibraryPath) return;
      await refreshSavedSearchList(expectedLibraryPath);
      setActiveSavedSearchName(definition.name);
      setSavedSearchBaseline(criteriaFromSavedSearch(definition));
      setError(null);
    } catch (updateError: unknown) {
      if (activeLibraryPathRef.current === expectedLibraryPath) {
        showOperationError('update-saved-search', updateError, 'Impossible de mettre à jour cette recherche enregistrée.');
      }
    }
  }

  async function handleDeleteSavedSearch(): Promise<void> {
    const id = activeSavedSearchId;
    const name = activeSavedSearchName;
    const expectedLibraryPath = activeLibraryPathRef.current;
    if (id === null || !name || !expectedLibraryPath) return;
    if (!(await confirmAction({
      title: 'Supprimer la recherche enregistrée',
      message: `Supprimer la recherche enregistrée « ${name} » ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    }))) return;
    try {
      await deleteSavedSearch(id, expectedLibraryPath);
      if (activeLibraryPathRef.current !== expectedLibraryPath) return;
      await refreshSavedSearchList(expectedLibraryPath);
      clearSavedSearchAssociation();
      setError(null);
    } catch (deleteError: unknown) {
      if (activeLibraryPathRef.current === expectedLibraryPath) {
        showOperationError('delete-saved-search', deleteError, 'Impossible de supprimer cette recherche enregistrée.');
      }
    }
  }

  function handleSearchChange(value: string) {
    if (!value.trim() && searchQuery.trim() && !hasStructuredSearchFilters) {
      clearSearchAndReturnToNavigation();
      return;
    }

    setSearchQuery(value);
    setSearchSortBy(value.trim() ? 'relevance' : naturalStructuredSort());
    setSearchDirection(value.trim() ? 'asc' : 'desc');
    if (value.trim() || hasStructuredSearchFilters) activateStructuredSearch();
    else hideSearchResults();
    if (value.trim()) {
      setPaneLayout((current) => {
        if (current.leftVisible) {
          return current;
        }
        restoreHiddenNavigationAfterSearchRef.current = true;
        return { ...current, leftVisible: true };
      });
    }
  }

  function showAdvancedSearch(): void {
    activateStructuredSearch();
    if (!searchQuery.trim()) {
      setSearchSortBy(naturalStructuredSort());
      setSearchDirection('desc');
    }
  }

  async function leaveAdvancedSearch(): Promise<void> {
    const origin = searchOrigin.current;
    if (selectedDocument && origin?.documentId === selectedDocument.id) {
      let available = false;
      try {
        const stored = await getDocument(selectedDocument.id);
        available = stored !== null && Boolean(stored.deleted_at) === Boolean(selectedDocument.deleted_at);
      } catch (loadError: unknown) {
        logRendererError('search-return', loadError);
      }
      if (origin !== searchOrigin.current) return;
      if (available || isDirtyRef.current) {
        hideSearchResults();
        restoreNavigationAfterSearch();
        if (!available) setError('Document indisponible. Le texte en cours reste dans l’éditeur.');
        return;
      }
      setSelectedDocument(null);
    }

    hideSearchResults();
    restoreNavigationAfterSearch();
    setDocumentView('all');
    setSelectedFolderId(null);
    setCatalogVisible(true);
    void refreshCatalog();
  }

  function handleSearchFieldChange(field: SearchTextField, checked: boolean): void {
    setSearchFields((current) => checked
      ? [...new Set([...current, field])]
      : current.filter((candidate) => candidate !== field));
    if (searchQuery.trim()) {
      setSearchSortBy('relevance');
      setSearchDirection('asc');
    }
  }

  function handleSearchMatchModeChange(mode: SearchMatchMode): void {
    setSearchMatchMode(mode);
    if (searchQuery.trim()) {
      setSearchSortBy('relevance');
      setSearchDirection('asc');
    }
  }

  function handleSearchFolderChange(folderId: number, checked: boolean): void {
    setSearchFolderSelection((current) => ({
      ...current,
      folderIds: checked
        ? [...new Set([...current.folderIds, folderId])]
        : current.folderIds.filter((candidate) => candidate !== folderId),
    }));
    activateStructuredSearch();
    resetSortForCriteria();
  }

  function handleSearchUnclassifiedChange(checked: boolean): void {
    setSearchFolderSelection((current) => ({ ...current, includeUnclassified: checked }));
    activateStructuredSearch();
    resetSortForCriteria();
  }

  function handleSearchStatusChange(nextStatus: DocumentStatus, checked: boolean): void {
    setSearchStatuses((current) => checked
      ? [...new Set([...current, nextStatus])]
      : current.filter((candidate) => candidate !== nextStatus));
    activateStructuredSearch();
    resetSortForCriteria();
  }

  function handleSearchFavoriteChange(checked: boolean): void {
    setSearchFavoriteOnly(checked);
    activateStructuredSearch();
    resetSortForCriteria();
  }

  function handleSearchDatePeriodChange(field: 'created' | 'modified', period: DatePeriod): void {
    const nextFilter = (current: SearchDateFilter): SearchDateFilter => ({ ...current, period });
    const nextCreated = field === 'created' ? nextFilter(createdFilter) : createdFilter;
    const nextModified = field === 'modified' ? nextFilter(modifiedFilter) : modifiedFilter;
    if (field === 'created') setCreatedFilter(nextCreated);
    else setModifiedFilter(nextModified);
    activateStructuredSearch();
    resetSortForCriteria(nextCreated, nextModified);
  }

  function handleSearchDateBoundaryChange(
    field: 'created' | 'modified',
    boundary: 'from' | 'to',
    value: string | null
  ): void {
    if (field === 'created') setCreatedFilter((current) => ({ ...current, [boundary]: value }));
    else setModifiedFilter((current) => ({ ...current, [boundary]: value }));
    activateStructuredSearch();
    resetSortForCriteria();
  }

  function resetSearchCriteria(): void {
    clearSavedSearchAssociation();
    searchRequestRef.current += 1;
    setSearchQuery('');
    setSearchFields(['title', 'content', 'notes']);
    setSearchMatchMode('all');
    setSearchFolderSelection({ folderIds: [], includeUnclassified: false });
    setSearchStatuses([]);
    setSearchFavoriteOnly(false);
    setCreatedFilter(emptyDateFilter());
    setModifiedFilter(emptyDateFilter());
    setSearchSortBy('updated_at');
    setSearchDirection('desc');
    setSearchValidationMessage(null);
    activateStructuredSearch();
  }

  function toggleNavigationPane() {
    restoreHiddenNavigationAfterSearchRef.current = false;
    setPaneLayout((current) => ({ ...current, leftVisible: !current.leftVisible }));
  }

  function toggleMetadataPane() {
    setPaneLayout((current) => ({ ...current, rightVisible: !current.rightVisible }));
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

      if (event.key === 'Escape') {
        if (confirmDialog) {
          event.preventDefault();
          resolveConfirmation(false);
          return;
        }

        if (savedSearchNameDialog) {
          event.preventDefault();
          setSavedSearchNameDialog(null);
          return;
        }

        if (hasActiveSearchCriteria || searchResultsVisible) {
          event.preventDefault();
          clearSearchAndReturnToNavigation();
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

      setPaneLayout((current) => {
        if (target === 'left') {
          const nextLeft = clamp(((pointerMoveEvent.clientX - rect.left) / totalWidth) * 100, 8, 34);
          const maxLeft = current.rightVisible ? 68 - current.right : 34;
          return { ...current, left: clamp(nextLeft, 8, maxLeft) };
        }

        const nextRight = clamp(((rect.right - pointerMoveEvent.clientX) / totalWidth) * 100, 8, 34);
        const maxRight = current.leftVisible ? 68 - current.left : 34;
        return { ...current, right: clamp(nextRight, 8, maxRight) };
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
            '--left-pane-track': paneLayout.leftVisible ? `minmax(76px, ${paneLayout.left}%)` : '0px',
            '--right-pane-track': paneLayout.rightVisible ? `minmax(84px, ${paneLayout.right}%)` : '0px',
            '--left-handle-width': paneLayout.leftVisible ? '6px' : '0px',
            '--right-handle-width': paneLayout.rightVisible ? '6px' : '0px',
          } as CSSProperties
        }
      >
        {paneLayout.leftVisible ? <NavigationPane
          key={libraryInfo?.path ?? 'loading-library'}
          allDocuments={documents}
          deletedDocuments={deletedDocuments}
          folders={folders}
          currentView={documentView}
          selectedFolderId={selectedFolderId}
          activeCount={documents.length}
          unfiledCount={unfiledCount}
          folderDocumentCounts={folderDocumentCounts}
          trashCount={deletedDocuments.length}
          selectedDocumentId={selectedDocument?.id ?? null}
          dirtyDocumentId={isDirty ? selectedDocument?.id ?? null : null}
          onViewChange={handleChangeDocumentView}
          onCreateDocument={handleCreateDocument}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onSelectDocument={handleSelectDocument}
          onEmptyTrash={handleEmptyTrash}
        /> : null}
        {paneLayout.leftVisible ? <button
          className="resize-handle left-resize-handle"
          type="button"
          aria-label="Redimensionner le volet gauche"
          onPointerDown={(event) => startPaneResize('left', event)}
        /> : null}
        {searchResultsVisible || catalogVisible ? <DocumentCatalog
          documents={searchResultsVisible ? searchResults : catalogDocuments}
          sortBy={searchResultsVisible ? searchSortBy : catalogOptions.sortBy}
          direction={searchResultsVisible ? searchDirection : catalogOptions.direction}
          selectedDocumentId={selectedDocument?.id ?? null}
          loading={searchResultsVisible ? searchLoading : catalogLoading}
          error={error}
          searchQuery={searchQuery}
          navigationVisible={paneLayout.leftVisible}
          metadataVisible={paneLayout.rightVisible}
          isTodo={selectedDocumentIsTodo}
          searching={searchResultsVisible}
          onAdvancedSearch={searchResultsVisible ? leaveAdvancedSearch : showAdvancedSearch}
          folders={folders}
          activeSavedSearchName={activeSavedSearchName}
          activeSavedSearchId={activeSavedSearchId}
          savedSearchModified={savedSearchModified}
          savedSearches={savedSearches}
          searchControls={{
            expanded: searchResultsVisible && advancedSearchExpanded,
            fields: searchFields,
            matchMode: searchMatchMode,
            folderSelection: searchFolderSelection,
            statuses: searchStatuses,
            favoriteOnly: searchFavoriteOnly,
            created: createdFilter,
            modified: modifiedFilter,
            validationMessage: searchValidationMessage,
            onToggleExpanded: () => setAdvancedSearchExpanded((current) => !current),
            onFieldChange: handleSearchFieldChange,
            onMatchModeChange: handleSearchMatchModeChange,
            onFolderChange: handleSearchFolderChange,
            onUnclassifiedChange: handleSearchUnclassifiedChange,
            onStatusChange: handleSearchStatusChange,
            onFavoriteChange: handleSearchFavoriteChange,
            onDatePeriodChange: handleSearchDatePeriodChange,
            onDateBoundaryChange: handleSearchDateBoundaryChange,
            onReset: resetSearchCriteria,
          }}
          onSort={handleCatalogSort}
          onOpenDocument={(id) => { void handleSelectDocument(id, 'all', null); }}
          onSearchChange={handleSearchChange}
          onClearSearch={clearSearchAndReturnToNavigation}
          onToggleNavigation={toggleNavigationPane}
          onToggleMetadata={toggleMetadataPane}
          onOpenTodo={handleOpenTodo}
          onSaveSearchAs={showSaveSavedSearchDialog}
          onUpdateSavedSearch={() => { void handleUpdateSavedSearch(); }}
          onRenameSavedSearch={showRenameSavedSearchDialog}
          onDeleteSavedSearch={() => { void handleDeleteSavedSearch(); }}
          onOpenSavedSearch={(id) => { void handleOpenSavedSearch(id); }}
        /> : <EditorPane
          positions={editorPositions}
          document={selectedDocument}
          title={title}
          content={content}
          saveState={displayedSaveState}
          isDirty={isDirty}
          error={error}
          notice={libraryNotice}
          isDeleted={selectedDocumentIsDeleted}
          isTodo={selectedDocumentIsTodo}
          advancedSearchActive={hasActiveSearchCriteria}
          searchQuery={searchQuery}
          onTitleChange={(value) => {
            setTitle(value);
            markDirty();
          }}
          onContentChange={(value) => {
            setContent(value);
            markDirty();
          }}
          navigationVisible={paneLayout.leftVisible}
          metadataVisible={paneLayout.rightVisible}
          onToggleNavigation={toggleNavigationPane}
          onToggleMetadata={toggleMetadataPane}
          onOpenTodo={handleOpenTodo}
          onOpenAdvancedSearch={showAdvancedSearch}
          onSearchChange={handleSearchChange}
          onClearSearch={clearSearchAndReturnToNavigation}
          onSave={handleSave}
          onTrash={handleTrashCurrentDocument}
          onRestore={handleRestoreCurrentDocument}
        />}
        {paneLayout.rightVisible ? <button
          className="resize-handle right-resize-handle"
          type="button"
          aria-label="Redimensionner le volet droit"
          onPointerDown={(event) => startPaneResize('right', event)}
        /> : null}
        {paneLayout.rightVisible ? <MetadataPane
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
        /> : null}
      </main>
      <StatusBar
        totalDocuments={currentDocuments.length}
        visibleDocuments={searchResultsVisible ? searchResults.length : currentDocuments.length}
        searchQuery={searchQuery}
        searchActive={searchResultsVisible}
        currentView={documentView}
        contextLabel={viewContextLabel}
        trashCount={deletedDocuments.length}
        selectedDocument={selectedDocument}
        status={status}
        saveState={displayedSaveState}
        characterCount={characterCount}
        wordCount={wordCount}
        version={__APP_VERSION__}
        libraryInfo={libraryInfo}
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
      {savedSearchNameDialog ? (
        <div className="confirm-backdrop" role="presentation">
          <form
            className="confirm-dialog saved-search-name-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-search-name-title"
            onSubmit={(event) => { event.preventDefault(); void submitSavedSearchNameDialog(); }}
          >
            <h2 id="saved-search-name-title">{savedSearchNameDialog.title}</h2>
            <label>
              Nom
              <input
                autoFocus
                maxLength={120}
                value={savedSearchNameDialog.value}
                onChange={(event) => setSavedSearchNameDialog((current) => current ? { ...current, value: event.target.value } : null)}
              />
            </label>
            <div className="confirm-actions">
              <button className="secondary-button" type="button" onClick={() => setSavedSearchNameDialog(null)}>Annuler</button>
              <button className="primary-button" type="submit" disabled={savedSearchNameDialog.submitting || !savedSearchNameDialog.value.trim()}>
                {savedSearchNameDialog.confirmLabel}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
