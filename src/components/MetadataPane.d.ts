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
export default function MetadataPane({ document, notes, status, favorite, characterCount, wordCount, onNotesChange, onStatusChange, onFavoriteChange, }: MetadataPaneProps): import("react").JSX.Element;
export {};
