import type { DocumentStatus, Folder, TextDocument } from '../types/document';

interface MetadataPaneProps {
  document: TextDocument | null;
  folders: Folder[];
  notes: string;
  status: DocumentStatus;
  favorite: boolean;
  folderId: number | null;
  isDeleted: boolean;
  characterCount: number;
  wordCount: number;
  onNotesChange: (value: string) => void;
  onStatusChange: (value: DocumentStatus) => void;
  onFavoriteChange: (value: boolean) => void;
  onFolderChange: (value: number | null) => void;
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

function folderLabel(folder: Folder, folders: Folder[]): string {
  const parents: string[] = [];
  let current = folder;

  while (current.parent_id !== null) {
    const parent = folders.find((candidate) => candidate.id === current.parent_id);
    if (!parent) {
      break;
    }
    parents.unshift(parent.name);
    current = parent;
  }

  return parents.length > 0 ? `${parents.join(' / ')} / ${folder.name}` : folder.name;
}

export default function MetadataPane({
  document,
  folders,
  notes,
  status,
  favorite,
  folderId,
  isDeleted,
  characterCount,
  wordCount,
  onNotesChange,
  onStatusChange,
  onFavoriteChange,
  onFolderChange,
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
            Dossier
            <select
              value={folderId ?? ''}
              onChange={(event) => onFolderChange(event.target.value === '' ? null : Number(event.target.value))}
              disabled={isDeleted}
            >
              <option value="">Non classe</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folderLabel(folder, folders)}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Statut
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value as DocumentStatus)}
              disabled={isDeleted}
            >
              {statuses.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(event) => onFavoriteChange(event.target.checked)}
              disabled={isDeleted}
            />
            Favori
          </label>

          <label className="field-label">
            Notes internes
            <textarea
              className="notes-editor"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Notes courtes..."
              disabled={isDeleted}
            />
          </label>
        </div>
      )}
    </aside>
  );
}
