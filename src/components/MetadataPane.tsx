import type { DocumentStatus, TextDocument } from '../types/document';

interface MetadataPaneProps {
  document: TextDocument | null;
  notes: string;
  status: DocumentStatus;
  favorite: boolean;
  characterCount: number;
  wordCount: number;
  onNotesChange: (value: string) => void;
  onStatusChange: (value: DocumentStatus) => void;
  onFavoriteChange: (value: boolean) => void;
}

const statuses: DocumentStatus[] = ['draft', 'active', 'to_review', 'final', 'archived'];

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function MetadataPane({
  document,
  notes,
  status,
  favorite,
  characterCount,
  wordCount,
  onNotesChange,
  onStatusChange,
  onFavoriteChange,
}: MetadataPaneProps) {
  return (
    <aside className="pane metadata-pane">
      <div className="pane-header metadata-header">
        <div>
          <p className="eyebrow">Document</p>
          <h2>Metadonnees</h2>
        </div>
      </div>

      {!document ? (
        <p className="empty-state">Selectionnez un texte pour afficher ses informations.</p>
      ) : (
        <div className="metadata-content">
          <dl className="metadata-list">
            <div>
              <dt>ID</dt>
              <dd>{document.id}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{document.content_format}</dd>
            </div>
            <div>
              <dt>Cree</dt>
              <dd>{formatDate(document.created_at)}</dd>
            </div>
            <div>
              <dt>Modifie</dt>
              <dd>{formatDate(document.updated_at)}</dd>
            </div>
            <div>
              <dt>Derniere ouverture</dt>
              <dd>{formatDate(document.last_opened_at)}</dd>
            </div>
            <div>
              <dt>Caracteres</dt>
              <dd>{characterCount}</dd>
            </div>
            <div>
              <dt>Mots</dt>
              <dd>{wordCount}</dd>
            </div>
          </dl>

          <label className="field-label">
            Statut
            <select value={status} onChange={(event) => onStatusChange(event.target.value as DocumentStatus)}>
              {statuses.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-label">
            <input type="checkbox" checked={favorite} onChange={(event) => onFavoriteChange(event.target.checked)} />
            Favori
          </label>

          <label className="field-label">
            Notes internes
            <textarea
              className="notes-editor"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Notes courtes..."
            />
          </label>
        </div>
      )}
    </aside>
  );
}
