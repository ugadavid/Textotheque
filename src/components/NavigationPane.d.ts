import type { Folder, TextDocument } from '../types/document';
type DocumentView = 'all' | 'unfiled' | 'folder' | 'trash';
interface NavigationPaneProps {
    documents: TextDocument[];
    allDocuments: TextDocument[];
    folders: Folder[];
    currentView: DocumentView;
    selectedFolderId: number | null;
    activeCount: number;
    unfiledCount: number;
    folderDocumentCounts: Record<number, number>;
    trashCount: number;
    totalDocuments: number;
    searchQuery: string;
    selectedDocumentId: number | null;
    dirtyDocumentId: number | null;
    onViewChange: (view: DocumentView, folderId?: number | null) => void;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onCreateDocument: () => void;
    onCreateFolder: (parentId: number | null) => void;
    onRenameFolder: (id: number, name: string) => void;
    onSelectDocument: (id: number, view?: DocumentView, folderId?: number | null) => void;
    onEmptyTrash: () => void;
}
export default function NavigationPane({ documents, allDocuments, folders, currentView, selectedFolderId, activeCount, unfiledCount, folderDocumentCounts, trashCount, totalDocuments, searchQuery, selectedDocumentId, dirtyDocumentId, onViewChange, onSearchChange, onClearSearch, onCreateDocument, onCreateFolder, onRenameFolder, onSelectDocument, onEmptyTrash, }: NavigationPaneProps): import("react").JSX.Element;
export {};
