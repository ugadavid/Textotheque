import type { TextDocument } from '../types/document';

const UNTITLED_FALLBACK = 'Sans titre';

interface NavigationPaneProps {
  documents: TextDocument[];
  selectedDocumentId: number | null;
  dirtyDocumentId: number | null;
  onCreateDocument: () => void;
  onSelectDocument: (id: number) => void;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Jamais ouvert';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function NavigationPane({
  documents,
  selectedDocumentId,
  dirtyDocumentId,
  onCreateDocument,
  onSelectDocument,
}: NavigationPaneProps) {
  return (
    <aside className="pane navigation-pane">
      <div className="pane-header">
        <div>
          <p className="eyebrow">Textotheque</p>
          <h1>Documents</h1>
        </div>
        <button className="icon-button" type="button" onClick={onCreateDocument} title="Nouveau document">
          +
        </button>
      </div>

      <div className="nav-summary">
        <span>Tous les textes</span>
        <strong>{documents.length}</strong>
      </div>

      <div className="document-list" aria-label="Liste des documents">
        {documents.length === 0 ? (
          <p className="empty-state">Aucun document pour le moment.</p>
        ) : (
          documents.map((document) => {
            const isDirty = dirtyDocumentId === document.id;
            const displayTitle = document.title.trim() || UNTITLED_FALLBACK;

            return (
              <button
                className={document.id === selectedDocumentId ? 'document-item selected' : 'document-item'}
                key={document.id}
                type="button"
                onClick={() => onSelectDocument(document.id)}
              >
                <span className="document-title">
                  {isDirty ? <span className="dirty-marker">*</span> : null}
                  {document.favorite ? '* ' : ''}
                  {displayTitle}
                </span>
                <span className="document-meta">
                  {document.status} - {formatDate(document.updated_at)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
