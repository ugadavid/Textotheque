import type { TextDocument } from '../types/document';
interface NavigationPaneProps {
    documents: TextDocument[];
    selectedDocumentId: number | null;
    onCreateDocument: () => void;
    onSelectDocument: (id: number) => void;
}
export default function NavigationPane({ documents, selectedDocumentId, onCreateDocument, onSelectDocument, }: NavigationPaneProps): import("react").JSX.Element;
export {};
