import type { TextDocument } from '../types/document';

interface EditorPaneProps {
  document: TextDocument | null;
  title: string;
  content: string;
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  error: string | null;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSave: () => void;
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
  error,
  onTitleChange,
  onContentChange,
  onSave,
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
        <input
          className="title-input"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Sans titre"
          aria-label="Titre du document"
        />
        <div className="save-controls">
          <span className={`save-state ${saveState}`}>{saveLabels[saveState]}</span>
          <button className="primary-button" type="button" onClick={onSave} disabled={saveState === 'saving'}>
            Sauvegarder
          </button>
        </div>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      <textarea
        className="content-editor"
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="Ecrire ici..."
        spellCheck="true"
      />
    </section>
  );
}
