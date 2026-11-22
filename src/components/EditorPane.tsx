import { useImperativeHandle, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject } from 'react';
import type { TextDocument } from '../types/document';
import { persistEditorPositions, type EditorPosition } from '../services/editor-positions';

interface EditorPaneProps {
  positions: Map<number, EditorPosition>;
  libraryPath?: string;
  capturePositionRef: MutableRefObject<(() => void) | null>;
  insertTextRef: MutableRefObject<((text: string) => boolean) | null>;
  document: TextDocument | null;
  title: string;
  content: string;
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  isDirty: boolean;
  error: string | null;
  notice: string | null;
  isDeleted: boolean;
  isTodo: boolean;
  advancedSearchActive: boolean;
  searchQuery: string;
  navigationVisible: boolean;
  metadataVisible: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onToggleNavigation: () => void;
  onToggleMetadata: () => void;
  onOpenTodo: () => void;
  onOpenAdvancedSearch: () => void;
  onSave: () => void;
  onTrash: () => void;
  onRestore: () => void;
}

const saveLabels = {
  idle: 'Pret',
  dirty: 'Modifie',
  saving: 'Sauvegarde...',
  saved: 'Sauvegarde',
  error: 'Erreur',
};

interface ContentEditorProps extends Pick<EditorPaneProps, 'positions' | 'libraryPath' | 'capturePositionRef' | 'insertTextRef' | 'content' | 'isDeleted' | 'onContentChange'> {
  documentId: number;
}

function ContentEditor({ documentId, positions, libraryPath, capturePositionRef, insertTextRef, content, isDeleted, onContentChange }: ContentEditorProps) {
  const contentEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretPositionRef = useRef<number | null>(null);
  const initialPosition = useRef<EditorPosition>();

  // On departure the keyed textarea still contains this document's text.
  useLayoutEffect(() => {
    const editor = contentEditorRef.current!;
    initialPosition.current = positions.get(documentId);
    function capture() {
      positions.set(documentId, {
        start: editor.selectionStart,
        end: editor.selectionEnd,
        direction: editor.selectionDirection,
        scrollTop: editor.scrollTop,
        scrollLeft: editor.scrollLeft,
      });
      persistEditorPositions(libraryPath, positions);
    }
    capturePositionRef.current = capture;
    return () => {
      capture();
      capturePositionRef.current = null;
    };
  }, [positions, documentId, libraryPath, capturePositionRef]);

  useLayoutEffect(() => {
    const caretPosition = pendingCaretPositionRef.current;
    const editor = contentEditorRef.current!;
    const saved = initialPosition.current;
    if (caretPosition !== null) {
      editor.focus();
      editor.setSelectionRange(caretPosition, caretPosition);
      pendingCaretPositionRef.current = null;
    } else if (saved) {
      const length = editor.value.length;
      editor.setSelectionRange(Math.min(saved.start, length), Math.min(saved.end, length), saved.direction);
      editor.scrollTop = saved.scrollTop;
      editor.scrollLeft = saved.scrollLeft;
      initialPosition.current = undefined;
    }
  }, [content, positions]);

  function insertText(text: string): boolean {
    const editor = contentEditorRef.current;
    if (!editor || isDeleted) return false;
    const start = editor.selectionStart;
    const caret = start + text.length;
    const next = content.slice(0, start) + text + content.slice(editor.selectionEnd);
    if (next !== content) {
      pendingCaretPositionRef.current = caret;
      onContentChange(next);
    } else {
      editor.focus();
      editor.setSelectionRange(caret, caret);
    }
    return true;
  }
  useImperativeHandle(insertTextRef, () => insertText);

  function handleContentKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (isDeleted || event.shiftKey || event.altKey || event.metaKey) return;
    if (event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const editor = event.currentTarget;
      const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight);
      editor.scrollTop += event.key === 'ArrowDown' ? lineHeight : -lineHeight;
      return;
    }
    if (event.key !== 'Tab' || event.ctrlKey) return;

    event.preventDefault();
    insertText('\t');
  }

  return <textarea
    ref={contentEditorRef}
    className="content-editor"
    value={content}
    onChange={(event) => onContentChange(event.target.value)}
    onKeyDown={handleContentKeyDown}
    placeholder="Ecrire ici..."
    spellCheck="true"
    disabled={isDeleted}
  />;
}

export default function EditorPane({
  positions,
  libraryPath,
  capturePositionRef,
  insertTextRef,
  document,
  title,
  content,
  saveState,
  isDirty,
  error,
  notice,
  isDeleted,
  isTodo,
  advancedSearchActive,
  searchQuery,
  navigationVisible,
  metadataVisible,
  onTitleChange,
  onContentChange,
  onSearchChange,
  onClearSearch,
  onToggleNavigation,
  onToggleMetadata,
  onOpenTodo,
  onOpenAdvancedSearch,
  onSave,
  onTrash,
  onRestore,
}: EditorPaneProps) {
  return (
    <section className="pane editor-pane">
      <header className="editor-toolbar">
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
        <div className="title-row">
          {document ? <>
            {isDirty ? <span className="title-dirty-marker" aria-label="Modifications non sauvegardees">*</span> : null}
            <input
              className="title-input"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Sans titre"
              aria-label="Titre du document"
              disabled={isDeleted}
            />
          </> : <span className="toolbar-empty-title">Aucun document sélectionné</span>}
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
          className={advancedSearchActive ? 'advanced-search-button active' : 'advanced-search-button'}
          type="button"
          onClick={onOpenAdvancedSearch}
        >
          Recherche avancée
        </button>
        <div className="save-controls">
          {document ? <>
            <span className={`save-state ${saveState}`}>{saveLabels[saveState]}</span>
            {isDeleted ? (
              <button className="primary-button" type="button" onClick={onRestore}>
                Restaurer
              </button>
            ) : (
              <>
                {!isTodo ? <button className="secondary-button trash-button" type="button" onClick={onTrash}>
                  Corbeille
                </button> : null}
                <button
                  className="primary-button"
                  type="button"
                  onClick={onSave}
                  disabled={saveState === 'saving'}
                  title="Sauvegarder - Ctrl+S"
                >
                  Sauvegarder
                </button>
              </>
            )}
          </> : null}
        </div>
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
      {notice ? <p className="success-message" role="status">{notice}</p> : null}
      {document ? <ContentEditor
          key={document.id}
          documentId={document.id}
          positions={positions}
          libraryPath={libraryPath}
          capturePositionRef={capturePositionRef}
          insertTextRef={insertTextRef}
          content={content}
          isDeleted={isDeleted}
          onContentChange={onContentChange}
        /> : <div className="empty-editor-content">
          <h2>Aucun document sélectionné</h2>
          <p>Créez un texte ou choisissez-en un dans la bibliothèque.</p>
        </div>}
    </section>
  );
}
