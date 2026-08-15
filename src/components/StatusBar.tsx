import type { DocumentStatus, TextDocument } from '../types/document';

type DocumentView = 'all' | 'unfiled' | 'folder' | 'trash';

interface StatusBarProps {
  totalDocuments: number;
  visibleDocuments: number;
  searchQuery: string;
  currentView: DocumentView;
  contextLabel: string;
  trashCount: number;
  selectedDocument: TextDocument | null;
  status: DocumentStatus;
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  characterCount: number;
  wordCount: number;
  version: string;
}

const saveLabels = {
  idle: 'Pret',
  dirty: 'Modifie',
  saving: 'Sauvegarde...',
  saved: 'Sauvegarde',
  error: 'Erreur',
};

export default function StatusBar({
  totalDocuments,
  visibleDocuments,
  searchQuery,
  currentView,
  contextLabel,
  trashCount,
  selectedDocument,
  status,
  saveState,
  characterCount,
  wordCount,
  version,
}: StatusBarProps) {
  const trimmedSearch = searchQuery.trim();

  return (
    <footer className="status-bar" aria-label="Statut de Textotheque">
      <span>Textotheque</span>
      <span>{contextLabel}</span>
      <span>{totalDocuments} documents</span>
      {currentView !== 'trash' ? <span>Corbeille: {trashCount}</span> : null}
      {trimmedSearch ? <span>{visibleDocuments} affiches</span> : null}
      {trimmedSearch ? <span>Recherche: "{trimmedSearch}"</span> : null}
      <span>{selectedDocument ? `Document ${selectedDocument.id}` : 'Aucune selection'}</span>
      <span>{selectedDocument?.content_format ?? 'plain'}</span>
      <span>{status}</span>
      <span>{saveLabels[saveState]}</span>
      <span>{wordCount} mots</span>
      <span>{characterCount} caracteres</span>
      <span>SQLite OK</span>
      <span>v{version}</span>
    </footer>
  );
}
