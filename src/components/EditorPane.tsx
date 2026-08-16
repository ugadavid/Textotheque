import { useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { TextDocument } from '../types/document';

interface EditorPaneProps {
  document: TextDocument | null;
  title: string;
  content: string;
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  isDirty: boolean;
  error: string | null;
  notice: string | null;
  isDeleted: boolean;
  searchQuery: string;
  navigationVisible: boolean;
  metadataVisible: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onToggleNavigation: () => void;
  onToggleMetadata: () => void;
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

export default function EditorPane({
  document,
  title,
  content,
  saveState,
  isDirty,
  error,
  notice,
  isDeleted,
  searchQuery,
  navigationVisible,
  metadataVisible,
  onTitleChange,
  onContentChange,
  onSearchChange,
  onClearSearch,
  onToggleNavigation,
  onToggleMetadata,
  onSave,
  onTrash,
  onRestore,
}: EditorPaneProps) {
  const contentEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretPositionRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const caretPosition = pendingCaretPositionRef.current;
    if (caretPosition === null || !contentEditorRef.current) return;

    contentEditorRef.current.focus();
    contentEditorRef.current.setSelectionRange(caretPosition, caretPosition);
    pendingCaretPositionRef.current = null;
  }, [content]);

  function handleContentKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (
      event.key !== 'Tab' ||
      event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      isDeleted
    ) {
      return;
    }

    event.preventDefault();
    const selectionStart = event.currentTarget.selectionStart;
    const selectionEnd = event.currentTarget.selectionEnd;
    const caretPosition = selectionStart + 1;
    pendingCaretPositionRef.current = caretPosition;
    onContentChange(`${content.slice(0, selectionStart)}\t${content.slice(selectionEnd)}`);
    event.currentTarget.setSelectionRange(caretPosition, caretPosition);
  }

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
        <div className="save-controls">
          {document ? <>
            <span className={`save-state ${saveState}`}>{saveLabels[saveState]}</span>
            {isDeleted ? (
              <button className="primary-button" type="button" onClick={onRestore}>
                Restaurer
              </button>
            ) : (
              <>
                <button className="secondary-button trash-button" type="button" onClick={onTrash}>
                  Corbeille
                </button>
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
      {document ? <textarea
          ref={contentEditorRef}
          className="content-editor"
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          onKeyDown={handleContentKeyDown}
          placeholder="Ecrire ici..."
          spellCheck="true"
          disabled={isDeleted}
        /> : <div className="empty-editor-content">
          <h2>Aucun document sélectionné</h2>
          <p>Créez un texte ou choisissez-en un dans la bibliothèque.</p>
        </div>}
    </section>
  );
}
