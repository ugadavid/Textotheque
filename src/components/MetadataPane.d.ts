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
export default function MetadataPane({ document, folders, notes, status, favorite, folderId, isDeleted, characterCount, wordCount, onNotesChange, onStatusChange, onFavoriteChange, onFolderChange, }: MetadataPaneProps): import("react").JSX.Element;
export {};
