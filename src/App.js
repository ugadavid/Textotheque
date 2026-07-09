import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, } from 'react';
import EditorPane from './components/EditorPane';
import MetadataPane from './components/MetadataPane';
import NavigationPane from './components/NavigationPane';
import { createDocument, listDocuments, saveDocument, selectDocument } from './services/documents';
const UNSAVED_CHANGES_MESSAGE = 'Ce document contient des modifications non sauvegardees. Voulez-vous vraiment continuer sans sauvegarder ?';
const PANE_STORAGE_KEY = 'textotheque:pane-widths:v1';
const UNTITLED_FALLBACK = 'Sans titre';
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
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState('draft');
    const [favorite, setFavorite] = useState(false);
    const [saveState, setSaveState] = useState('idle');
    const [error, setError] = useState(null);
    const [paneWidths, setPaneWidths] = useState(() => loadPaneWidths());
    const [confirmDialog, setConfirmDialog] = useState(null);
    const shellRef = useRef(null);
    const isDirtyRef = useRef(false);
    useEffect(() => {
        void refreshDocuments();
    }, []);
    const characterCount = content.length;
    const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
    const isDirty = Boolean(selectedDocument &&
        (title !== titleForEditing(selectedDocument.title) ||
            content !== selectedDocument.content ||
            notes !== selectedDocument.notes ||
            status !== selectedDocument.status ||
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
    const confirmDiscardUnsavedChanges = useCallback(async () => {
        if (!isDirtyRef.current) {
            return true;
        }
        return new Promise((resolve) => {
            setConfirmDialog({ resolve });
        });
    }, []);
    function resolveDiscardConfirmation(confirmed) {
        const resolve = confirmDialog?.resolve;
        setConfirmDialog(null);
        resolve?.(confirmed);
        if (!confirmed) {
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
    async function refreshDocuments(nextSelectedId) {
        const nextDocuments = await listDocuments();
        setDocuments(nextDocuments);
        if (nextDocuments.length === 0) {
            setSelectedDocument(null);
            setTitle('');
            setContent('');
            setNotes('');
            setStatus('draft');
            setFavorite(false);
            setSaveState('idle');
            return;
        }
        const targetId = nextSelectedId ?? selectedDocument?.id ?? nextDocuments[0].id;
        const nextSelected = nextDocuments.find((document) => document.id === targetId) ?? nextDocuments[0];
        applyDocument(nextSelected);
    }
    function applyDocument(document) {
        setSelectedDocument(document);
        setTitle(titleForEditing(document.title));
        setContent(document.content);
        setNotes(document.notes);
        setStatus(document.status);
        setFavorite(document.favorite === 1);
        setSaveState('saved');
        setError(null);
    }
    function markDirty() {
        if (selectedDocument) {
            setSaveState('dirty');
        }
    }
    async function handleCreateDocument() {
        if (!(await confirmDiscardUnsavedChanges())) {
            return;
        }
        setError(null);
        const document = await createDocument();
        await refreshDocuments(document.id);
        focusEditor();
    }
    async function handleSelectDocument(id) {
        if (id === selectedDocument?.id) {
            return;
        }
        if (!(await confirmDiscardUnsavedChanges())) {
            return;
        }
        setError(null);
        const document = await selectDocument(id);
        if (document) {
            applyDocument(document);
            await refreshDocuments(document.id);
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
            });
            applyDocument(saved);
            await refreshDocuments(saved.id);
            setSaveState('saved');
        }
        catch (saveError) {
            setSaveState('error');
            setError(saveError instanceof Error ? saveError.message : 'Sauvegarde impossible.');
        }
    }
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
    return (_jsxs("main", { className: "app-shell", ref: shellRef, style: {
            '--left-pane-width': `${paneWidths.left}%`,
            '--right-pane-width': `${paneWidths.right}%`,
        }, children: [_jsx(NavigationPane, { documents: documents, selectedDocumentId: selectedDocument?.id ?? null, dirtyDocumentId: isDirty ? selectedDocument?.id ?? null : null, onCreateDocument: handleCreateDocument, onSelectDocument: handleSelectDocument }), _jsx("button", { className: "resize-handle", type: "button", "aria-label": "Redimensionner le volet gauche", onPointerDown: (event) => startPaneResize('left', event) }), _jsx(EditorPane, { document: selectedDocument, title: title, content: content, saveState: displayedSaveState, isDirty: isDirty, error: error, onTitleChange: (value) => {
                    setTitle(value);
                    markDirty();
                }, onContentChange: (value) => {
                    setContent(value);
                    markDirty();
                }, onSave: handleSave }), _jsx("button", { className: "resize-handle", type: "button", "aria-label": "Redimensionner le volet droit", onPointerDown: (event) => startPaneResize('right', event) }), _jsx(MetadataPane, { document: selectedDocument, notes: notes, status: status, favorite: favorite, characterCount: characterCount, wordCount: wordCount, onNotesChange: (value) => {
                    setNotes(value);
                    markDirty();
                }, onStatusChange: (value) => {
                    setStatus(value);
                    markDirty();
                }, onFavoriteChange: (value) => {
                    setFavorite(value);
                    markDirty();
                } }), confirmDialog ? (_jsx("div", { className: "confirm-backdrop", role: "presentation", children: _jsxs("section", { className: "confirm-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "discard-title", children: [_jsx("h2", { id: "discard-title", children: "Modifications non sauvegardees" }), _jsx("p", { children: UNSAVED_CHANGES_MESSAGE }), _jsxs("div", { className: "confirm-actions", children: [_jsx("button", { className: "secondary-button", type: "button", onClick: () => resolveDiscardConfirmation(false), children: "Annuler" }), _jsx("button", { className: "danger-button", type: "button", onClick: () => resolveDiscardConfirmation(true), children: "Continuer sans sauvegarder" })] })] }) })) : null] }));
}
