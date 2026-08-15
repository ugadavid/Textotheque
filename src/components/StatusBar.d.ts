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
export default function StatusBar({ totalDocuments, visibleDocuments, searchQuery, currentView, contextLabel, trashCount, selectedDocument, status, saveState, characterCount, wordCount, version, }: StatusBarProps): import("react").JSX.Element;
export {};
