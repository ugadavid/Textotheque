import type { TextDocument } from '../types/document';
interface EditorPaneProps {
    document: TextDocument | null;
    title: string;
    content: string;
    saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
    error: string | null;
    onTitleChange: (value: string) => void;
    onContentChange: (value: string) => void;
    onSave: () => void;
}
export default function EditorPane({ document, title, content, saveState, error, onTitleChange, onContentChange, onSave, }: EditorPaneProps): import("react").JSX.Element;
export {};
