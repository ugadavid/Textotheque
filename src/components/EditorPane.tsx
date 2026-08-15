import type { TextDocument } from '../types/document';

interface EditorPaneProps {
  document: TextDocument | null;
  title: string;
  content: string;
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  isDirty: boolean;
  error: string | null;
  isDeleted: boolean;
  searchQuery: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
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
  isDeleted,
  searchQuery,
  onTitleChange,
  onContentChange,
  onSearchChange,
  onClearSearch,
  onSave,
  onTrash,
  onRestore,
}: EditorPaneProps) {
  return (
    <section className="pane editor-pane">
      <header className="editor-toolbar">
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
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher dans Textothèque..."
            aria-label="Rechercher dans Textothèque"
            title="Rechercher - Ctrl+F"
          />
          {searchQuery.trim() ? <button className="clear-search-button" type="button" onClick={onClearSearch} title="Vider la recherche" aria-label="Vider la recherche">×</button> : null}
        </div>
        {document ? <div className="save-controls">
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
        </div> : <div className="save-controls toolbar-empty-actions" />}
      </header>

      {error ? <p className="error-message">{error}</p> : null}
      {document ? <textarea
          className="content-editor"
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
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
