import type { TextDocument } from '../types/document';

interface EditorPaneProps {
  document: TextDocument | null;
  title: string;
  content: string;
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  isDirty: boolean;
  error: string | null;
  isDeleted: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
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
  onTitleChange,
  onContentChange,
  onSave,
  onTrash,
  onRestore,
}: EditorPaneProps) {
  if (!document) {
    return (
      <section className="pane editor-pane empty-editor">
        <h2>Aucun document selectionne</h2>
        <p>Creez un premier texte depuis le volet gauche.</p>
      </section>
    );
  }

  return (
    <section className="pane editor-pane">
      <header className="editor-toolbar">
        <div className="title-row">
          {isDirty ? <span className="title-dirty-marker" aria-label="Modifications non sauvegardees">*</span> : null}
          <input
            className="title-input"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Sans titre"
            aria-label="Titre du document"
            disabled={isDeleted}
          />
        </div>
        <div className="save-controls">
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
        </div>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      <textarea
        className="content-editor"
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="Ecrire ici..."
        spellCheck="true"
        disabled={isDeleted}
      />
    </section>
  );
}
