import type { TextDocument } from '../types/document';
interface EditorPaneProps {
    document: TextDocument | null;
    title: string;
    content: string;
    saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
    isDirty: boolean;
    error: string | null;
    isDeleted: boolean;
    onTitleChange: (value: string) => void;
    onContentChange: (value: string) => void;
    onSave: () => void;
    onTrash: () => void;
    onRestore: () => void;
}
export default function EditorPane({ document, title, content, saveState, isDirty, error, isDeleted, onTitleChange, onContentChange, onSave, onTrash, onRestore, }: EditorPaneProps): import("react").JSX.Element;
export {};
