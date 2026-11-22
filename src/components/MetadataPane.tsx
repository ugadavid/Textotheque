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

const statuses: ReadonlyArray<[DocumentStatus, string]> = [
  ['draft', 'Brouillon'], ['active', 'Actif'], ['to_review', 'À revoir'], ['final', 'Final'], ['archived', 'Archivé'],
];

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
        <h2>Info</h2>
        {document && <button type="button" className="info-favorite" aria-pressed={favorite}
          aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={() => onFavoriteChange(!favorite)} disabled={isDeleted}>{favorite ? '★' : '☆'}</button>}
      </div>

      {!document ? (
        <p className="empty-state">Selectionnez un texte pour afficher ses informations.</p>
      ) : (
        <div className="metadata-content">
          <fieldset className="info-status" disabled={isDeleted}>
            <legend>Statut</legend>
            {statuses.map(([value, label]) => (
              <label key={value}><input type="radio" name="document-status" value={value}
                checked={status === value} onChange={() => onStatusChange(value)} /> {label}</label>
            ))}
          </fieldset>

          <label className="field-label">
            Dossier
            <select
              value={folderId ?? ''}
              onChange={(event) => onFolderChange(event.target.value === '' ? null : Number(event.target.value))}
              disabled={isDeleted}
            >
              <option value="">Non classé</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folderLabel(folder, folders)}
                </option>
              ))}
            </select>
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

          <dl className="metadata-list">
            <div><dt>Créé</dt><dd>{formatDate(document.created_at)}</dd></div>
            <div><dt>Modifié</dt><dd>{formatDate(document.updated_at)}</dd></div>
            <div><dt>Dernière ouverture</dt><dd>{formatDate(document.last_opened_at)}</dd></div>
          </dl>
          <div className="info-counts"><span>Caractères : {characterCount}</span><span>Mots : {wordCount}</span></div>
          <footer className="info-footer"><span>ID : {document.id}</span><span>Format : {document.content_format}</span></footer>
        </div>
      )}
    </aside>
  );
}
