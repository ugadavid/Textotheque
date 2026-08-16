import type { DocumentStatus, TextDocument } from '../types/document';
import type { LibraryInfo } from '../types/library';

type DocumentView = 'navigation' | 'all' | 'unfiled' | 'folder' | 'trash';

interface StatusBarProps {
  totalDocuments: number;
  visibleDocuments: number;
  searchQuery: string;
  searchActive: boolean;
  currentView: DocumentView;
  contextLabel: string;
  trashCount: number;
  selectedDocument: TextDocument | null;
  status: DocumentStatus;
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  characterCount: number;
  wordCount: number;
  version: string;
  libraryInfo: LibraryInfo | null;
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
  searchActive,
  currentView,
  contextLabel,
  trashCount,
  selectedDocument,
  status,
  saveState,
  characterCount,
  wordCount,
  version,
  libraryInfo,
}: StatusBarProps) {
  const trimmedSearch = searchQuery.trim();

  return (
    <footer className="status-bar" aria-label="Statut de Textotheque">
      <span>Textotheque</span>
      <span>{contextLabel}</span>
      <span>{totalDocuments} documents</span>
      {currentView !== 'trash' ? <span>Corbeille: {trashCount}</span> : null}
      {searchActive ? <span>{visibleDocuments} affiches</span> : null}
      {trimmedSearch ? <span>Recherche: "{trimmedSearch}"</span> : null}
      {searchActive && !trimmedSearch ? <span>Recherche par date</span> : null}
      <span>{selectedDocument ? `Document ${selectedDocument.id}` : 'Aucune selection'}</span>
      <span>{selectedDocument?.content_format ?? 'plain'}</span>
      <span>{status}</span>
      <span>{saveLabels[saveState]}</span>
      <span>{wordCount} mots</span>
      <span>{characterCount} caracteres</span>
      <span>SQLite OK</span>
      {libraryInfo ? <span className="library-name" title={libraryInfo.path}>Bibliothèque : {libraryInfo.fileName}</span> : null}
      <span>v{version}</span>
    </footer>
  );
}
