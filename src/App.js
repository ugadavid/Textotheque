import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, } from 'react';
import EditorPane from './components/EditorPane';
import MetadataPane from './components/MetadataPane';
import NavigationPane from './components/NavigationPane';
import StatusBar from './components/StatusBar';
import { createFolder, createDocument, emptyTrash, listDeletedDocuments, listFolders, listDocuments, renameFolder, restoreDocument, saveDocument, selectDocument, trashDocument, } from './services/documents';
const UNSAVED_CHANGES_MESSAGE = 'Ce document contient des modifications non sauvegardees. Voulez-vous vraiment continuer sans sauvegarder ?';
const PANE_STORAGE_KEY = 'textotheque:pane-widths:v1';
const UNTITLED_FALLBACK = 'Sans titre';
const APP_VERSION = '0.1.13';
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function loadPaneWidths() {
    const fallback = { left: 22, right: 24 };
    try {
        const stored = window.localStorage.getItem(PANE_STORAGE_KEY);
        if (!stored) {
            return fallback;
        }
        const parsed = JSON.parse(stored);
        if (typeof parsed.left !== 'number' || typeof parsed.right !== 'number') {
            return fallback;
        }
        return {
            left: clamp(parsed.left, 18, 34),
            right: clamp(parsed.right, 18, 34),
        };
    }
    catch {
        return fallback;
    }
}
function titleForEditing(title) {
    const trimmedTitle = title.trim();
    return trimmedTitle === '' || trimmedTitle === UNTITLED_FALLBACK ? '' : title;
}
export default function App() {
    const [documents, setDocuments] = useState([]);
    const [deletedDocuments, setDeletedDocuments] = useState([]);
    const [folders, setFolders] = useState([]);
    const [documentView, setDocumentView] = useState('all');
    const [selectedFolderId, setSelectedFolderId] = useState(null);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState('draft');
    const [favorite, setFavorite] = useState(false);
    const [folderId, setFolderId] = useState(null);
    const [saveState, setSaveState] = useState('idle');
    const [error, setError] = useState(null);
    const [paneWidths, setPaneWidths] = useState(() => loadPaneWidths());
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const shellRef = useRef(null);
    const isDirtyRef = useRef(false);
    useEffect(() => {
        void refreshDocuments();
    }, []);
    const characterCount = content.length;
    const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
    const selectedFolder = useMemo(() => folders.find((folder) => folder.id === selectedFolderId) ?? null, [folders, selectedFolderId]);
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
    const unfiledCount = useMemo(() => documents.filter((document) => document.folder_id === null).length, [documents]);
    const folderDocumentCounts = useMemo(() => documents.reduce((counts, document) => {
        if (document.folder_id !== null) {
            counts[document.folder_id] = (counts[document.folder_id] ?? 0) + 1;
        }
        return counts;
    }, {}), [documents]);
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
    const isDirty = Boolean(selectedDocument &&
        (title !== titleForEditing(selectedDocument.title) ||
            content !== selectedDocument.content ||
            notes !== selectedDocument.notes ||
            status !== selectedDocument.status ||
            folderId !== selectedDocument.folder_id ||
            favorite !== (selectedDocument.favorite === 1)));
    const displayedSaveState = isDirty ? 'dirty' : saveState;
    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);
    useEffect(() => {
        window.localStorage.setItem(PANE_STORAGE_KEY, JSON.stringify(paneWidths));
    }, [paneWidths]);
    const focusEditor = useCallback(() => {
        window.requestAnimationFrame(() => {
            document.querySelector('.content-editor')?.focus();
        });
    }, []);
    const focusSearch = useCallback(() => {
        window.requestAnimationFrame(() => {
            const searchInput = document.querySelector('.search-input-row input');
            searchInput?.focus();
            searchInput?.select();
        });
    }, []);
    const focusTitle = useCallback(() => {
        window.requestAnimationFrame(() => {
            const titleInput = document.querySelector('.title-input:not(:disabled)');
            titleInput?.focus();
            titleInput?.select();
        });
    }, []);
    const confirmAction = useCallback(async (dialog) => new Promise((resolve) => {
        setConfirmDialog({ ...dialog, resolve });
    }), []);
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
        return new Promise((resolve) => {
            setConfirmDialog({
                title: 'Deplacer vers la corbeille',
                message: 'Deplacer ce document vers la corbeille ? Vous pourrez le restaurer ensuite.',
                confirmLabel: 'Deplacer',
                danger: true,
                resolve,
            });
        });
    }
    async function confirmEmptyTrash(count) {
        return confirmAction({
            title: 'Vider la corbeille',
            message: `Vider la corbeille ? ${count} document(s) seront supprimes definitivement.`,
            confirmLabel: 'Vider',
            danger: true,
        });
    }
    function resolveConfirmation(confirmed) {
        const dialog = confirmDialog;
        const resolve = dialog?.resolve;
        setConfirmDialog(null);
        resolve?.(confirmed);
        if (!confirmed && dialog?.focusAfterCancel) {
            focusEditor();
        }
    }
    useEffect(() => {
        const removeCloseListener = window.textotheque.onCloseRequested(async () => {
            if (await confirmDiscardUnsavedChanges()) {
                void window.textotheque.approveClose();
            }
        });
        const handleBeforeUnload = (event) => {
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
    function documentsForView(activeDocuments, trashDocuments, view, targetFolderId) {
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
    async function refreshDocuments(nextSelectedId, viewOverride = documentView, folderOverride = selectedFolderId) {
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
    function applyDocument(document) {
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
    async function handleChangeDocumentView(nextView, nextFolderId = null) {
        if (nextView === documentView && nextFolderId === selectedFolderId) {
            return;
        }
        if (!(await confirmDiscardUnsavedChanges())) {
            return;
        }
        setDocumentView(nextView);
        setSelectedFolderId(nextFolderId);
        setError(null);
        await refreshDocuments(undefined, nextView, nextFolderId);
    }
    async function handleCreateDocument() {
        if (!(await confirmDiscardUnsavedChanges())) {
            return;
        }
        const targetFolderId = documentView === 'folder'
            ? selectedFolderId
            : selectedDocument && !selectedDocumentIsDeleted
                ? selectedDocument.folder_id
                : null;
        const targetView = targetFolderId === null ? 'all' : 'folder';
        setDocumentView(targetView);
        setSelectedFolderId(targetFolderId);
        setError(null);
        const document = await createDocument(targetFolderId);
        await refreshDocuments(document.id, targetView, targetFolderId);
        focusEditor();
    }
    async function handleCreateFolder(parentId = null) {
        if (!(await confirmDiscardUnsavedChanges())) {
            return;
        }
        setError(null);
        const folder = await createFolder(parentId);
        setDocumentView('folder');
        setSelectedFolderId(folder.id);
        await refreshDocuments(undefined, 'folder', folder.id);
    }
    async function handleRenameFolder(id, name) {
        setError(null);
        const folder = await renameFolder(id, name);
        setFolders((currentFolders) => currentFolders.map((item) => (item.id === folder.id ? folder : item)));
        await refreshDocuments(selectedDocument?.id, documentView, selectedFolderId);
    }
    async function handleSelectDocument(id, nextView, nextFolderId) {
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
        const document = await selectDocument(id);
        if (document) {
            if (nextView) {
                setDocumentView(nextView);
                setSelectedFolderId(nextFolderId ?? null);
            }
            applyDocument(document);
            await refreshDocuments(document.id, nextView ?? documentView, nextFolderId ?? selectedFolderId);
            focusEditor();
        }
    }
    async function handleSave() {
        if (!selectedDocument) {
            return;
        }
        setSaveState('saving');
        setError(null);
        try {
            const saved = await saveDocument(selectedDocument.id, {
                title,
                content,
                notes,
                status,
                favorite,
                folder_id: folderId,
            });
            let nextView = documentView;
            let nextFolderId = selectedFolderId;
            if (documentView === 'folder' || documentView === 'unfiled') {
                if (saved.folder_id === null) {
                    nextView = 'unfiled';
                    nextFolderId = null;
                }
                else {
                    nextView = 'folder';
                    nextFolderId = saved.folder_id;
                }
                setDocumentView(nextView);
                setSelectedFolderId(nextFolderId);
            }
            applyDocument(saved);
            await refreshDocuments(saved.id, nextView, nextFolderId);
            setSaveState('saved');
        }
        catch (saveError) {
            setSaveState('error');
            setError(saveError instanceof Error ? saveError.message : 'Sauvegarde impossible.');
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
        await trashDocument(selectedDocument.id);
        await refreshDocuments(undefined, 'all', null);
    }
    async function handleRestoreCurrentDocument() {
        if (!selectedDocument || !selectedDocumentIsDeleted) {
            return;
        }
        setError(null);
        const restored = await restoreDocument(selectedDocument.id);
        setDocumentView('all');
        setSelectedFolderId(null);
        await refreshDocuments(restored.id, 'all', null);
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
        await emptyTrash();
        await refreshDocuments(undefined, 'trash', null);
    }
    useEffect(() => {
        function handleKeyDown(event) {
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
                if (activeElement instanceof HTMLInputElement &&
                    activeElement.matches('.search-input-row input') &&
                    searchQuery.trim().length > 0) {
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
    function startPaneResize(target, pointerDownEvent) {
        const shell = shellRef.current;
        if (!shell) {
            return;
        }
        pointerDownEvent.preventDefault();
        pointerDownEvent.currentTarget.setPointerCapture(pointerDownEvent.pointerId);
        const rect = shell.getBoundingClientRect();
        function handlePointerMove(pointerMoveEvent) {
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
    return (_jsxs("div", { className: "app-root", children: [_jsxs("main", { className: "app-shell", ref: shellRef, style: {
                    '--left-pane-width': `${paneWidths.left}%`,
                    '--right-pane-width': `${paneWidths.right}%`,
                }, children: [_jsx(NavigationPane, { documents: visibleDocuments, allDocuments: documents, folders: folders, currentView: documentView, selectedFolderId: selectedFolderId, activeCount: documents.length, unfiledCount: unfiledCount, folderDocumentCounts: folderDocumentCounts, trashCount: deletedDocuments.length, totalDocuments: currentDocuments.length, searchQuery: searchQuery, selectedDocumentId: selectedDocument?.id ?? null, dirtyDocumentId: isDirty ? selectedDocument?.id ?? null : null, onViewChange: handleChangeDocumentView, onSearchChange: setSearchQuery, onClearSearch: () => setSearchQuery(''), onCreateDocument: handleCreateDocument, onCreateFolder: handleCreateFolder, onRenameFolder: handleRenameFolder, onSelectDocument: handleSelectDocument, onEmptyTrash: handleEmptyTrash }), _jsx("button", { className: "resize-handle", type: "button", "aria-label": "Redimensionner le volet gauche", onPointerDown: (event) => startPaneResize('left', event) }), _jsx(EditorPane, { document: selectedDocument, title: title, content: content, saveState: displayedSaveState, isDirty: isDirty, error: error, isDeleted: selectedDocumentIsDeleted, onTitleChange: (value) => {
                            setTitle(value);
                            markDirty();
                        }, onContentChange: (value) => {
                            setContent(value);
                            markDirty();
                        }, onSave: handleSave, onTrash: handleTrashCurrentDocument, onRestore: handleRestoreCurrentDocument }), _jsx("button", { className: "resize-handle", type: "button", "aria-label": "Redimensionner le volet droit", onPointerDown: (event) => startPaneResize('right', event) }), _jsx(MetadataPane, { document: selectedDocument, folders: folders, notes: notes, status: status, favorite: favorite, folderId: folderId, isDeleted: selectedDocumentIsDeleted, characterCount: characterCount, wordCount: wordCount, onNotesChange: (value) => {
                            setNotes(value);
                            markDirty();
                        }, onStatusChange: (value) => {
                            setStatus(value);
                            markDirty();
                        }, onFavoriteChange: (value) => {
                            setFavorite(value);
                            markDirty();
                        }, onFolderChange: (value) => {
                            setFolderId(value);
                            markDirty();
                        } })] }), _jsx(StatusBar, { totalDocuments: currentDocuments.length, visibleDocuments: visibleDocuments.length, searchQuery: searchQuery, currentView: documentView, contextLabel: viewContextLabel, trashCount: deletedDocuments.length, selectedDocument: selectedDocument, status: status, saveState: displayedSaveState, characterCount: characterCount, wordCount: wordCount, version: APP_VERSION }), confirmDialog ? (_jsx("div", { className: "confirm-backdrop", role: "presentation", children: _jsxs("section", { className: "confirm-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "confirm-title", children: [_jsx("h2", { id: "confirm-title", children: confirmDialog.title }), _jsx("p", { children: confirmDialog.message }), _jsxs("div", { className: "confirm-actions", children: [_jsx("button", { className: "secondary-button", type: "button", onClick: () => resolveConfirmation(false), children: "Annuler" }), _jsx("button", { className: confirmDialog.danger ? 'danger-button' : 'primary-button', type: "button", onClick: () => resolveConfirmation(true), children: confirmDialog.confirmLabel })] })] }) })) : null] }));
}
