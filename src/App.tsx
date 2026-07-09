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
import { createDocument, listDocuments, saveDocument, selectDocument } from './services/documents';
import type { DocumentStatus, TextDocument } from './types/document';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type ResizeTarget = 'left' | 'right';

const UNSAVED_CHANGES_MESSAGE =
  'Ce document contient des modifications non sauvegardees. Voulez-vous vraiment continuer sans sauvegarder ?';
const PANE_STORAGE_KEY = 'textotheque:pane-widths:v1';
const UNTITLED_FALLBACK = 'Sans titre';

interface PaneWidths {
  left: number;
  right: number;
}

interface ConfirmDialogState {
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
  const [selectedDocument, setSelectedDocument] = useState<TextDocument | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<DocumentStatus>('draft');
  const [favorite, setFavorite] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paneWidths, setPaneWidths] = useState<PaneWidths>(() => loadPaneWidths());
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    void refreshDocuments();
  }, []);

  const characterCount = content.length;
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const isDirty = Boolean(
    selectedDocument &&
      (title !== titleForEditing(selectedDocument.title) ||
        content !== selectedDocument.content ||
        notes !== selectedDocument.notes ||
        status !== selectedDocument.status ||
        favorite !== (selectedDocument.favorite === 1))
  );
  const displayedSaveState: SaveState = isDirty ? 'dirty' : saveState;

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

  const confirmDiscardUnsavedChanges = useCallback(async () => {
    if (!isDirtyRef.current) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      setConfirmDialog({ resolve });
    });
  }, []);

  function resolveDiscardConfirmation(confirmed: boolean) {
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

  async function refreshDocuments(nextSelectedId?: number) {
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

  function applyDocument(document: TextDocument) {
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

  async function handleSelectDocument(id: number) {
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
    } catch (saveError) {
      setSaveState('error');
      setError(saveError instanceof Error ? saveError.message : 'Sauvegarde impossible.');
    }
  }

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
        documents={documents}
        selectedDocumentId={selectedDocument?.id ?? null}
        dirtyDocumentId={isDirty ? selectedDocument?.id ?? null : null}
        onCreateDocument={handleCreateDocument}
        onSelectDocument={handleSelectDocument}
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
        onTitleChange={(value) => {
          setTitle(value);
          markDirty();
        }}
        onContentChange={(value) => {
          setContent(value);
          markDirty();
        }}
        onSave={handleSave}
      />
      <button
        className="resize-handle"
        type="button"
        aria-label="Redimensionner le volet droit"
        onPointerDown={(event) => startPaneResize('right', event)}
      />
      <MetadataPane
        document={selectedDocument}
        notes={notes}
        status={status}
        favorite={favorite}
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
      />
      {confirmDialog ? (
        <div className="confirm-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="discard-title">
            <h2 id="discard-title">Modifications non sauvegardees</h2>
            <p>{UNSAVED_CHANGES_MESSAGE}</p>
            <div className="confirm-actions">
              <button className="secondary-button" type="button" onClick={() => resolveDiscardConfirmation(false)}>
                Annuler
              </button>
              <button className="danger-button" type="button" onClick={() => resolveDiscardConfirmation(true)}>
                Continuer sans sauvegarder
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
