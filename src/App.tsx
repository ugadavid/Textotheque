import { useEffect, useMemo, useState } from 'react';
import EditorPane from './components/EditorPane';
import MetadataPane from './components/MetadataPane';
import NavigationPane from './components/NavigationPane';
import { createDocument, listDocuments, saveDocument, selectDocument } from './services/documents';
import type { DocumentStatus, TextDocument } from './types/document';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export default function App() {
  const [documents, setDocuments] = useState<TextDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<TextDocument | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<DocumentStatus>('draft');
  const [favorite, setFavorite] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshDocuments();
  }, []);

  const characterCount = content.length;
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);

  async function refreshDocuments(nextSelectedId?: number) {
    const nextDocuments = await listDocuments();
    setDocuments(nextDocuments);

    if (nextDocuments.length === 0) {
      setSelectedDocument(null);
      setTitle('');
      setContent('');
      setNotes('');
      setStatus('draft');
      setFavorite(false);
      setSaveState('idle');
      return;
    }

    const targetId = nextSelectedId ?? selectedDocument?.id ?? nextDocuments[0].id;
    const nextSelected = nextDocuments.find((document) => document.id === targetId) ?? nextDocuments[0];
    applyDocument(nextSelected);
  }

  function applyDocument(document: TextDocument) {
    setSelectedDocument(document);
    setTitle(document.title);
    setContent(document.content);
    setNotes(document.notes);
    setStatus(document.status);
    setFavorite(document.favorite === 1);
    setSaveState('saved');
    setError(null);
  }

  function markDirty() {
    if (selectedDocument) {
      setSaveState('dirty');
    }
  }

  async function handleCreateDocument() {
    setError(null);
    const document = await createDocument();
    await refreshDocuments(document.id);
  }

  async function handleSelectDocument(id: number) {
    setError(null);
    const document = await selectDocument(id);
    if (document) {
      applyDocument(document);
      await refreshDocuments(document.id);
    }
  }

  async function handleSave() {
    if (!selectedDocument) {
      return;
    }

    setSaveState('saving');
    setError(null);

    try {
      const saved = await saveDocument(selectedDocument.id, {
        title,
        content,
        notes,
        status,
        favorite,
      });
      applyDocument(saved);
      await refreshDocuments(saved.id);
      setSaveState('saved');
    } catch (saveError) {
      setSaveState('error');
      setError(saveError instanceof Error ? saveError.message : 'Sauvegarde impossible.');
    }
  }

  return (
    <main className="app-shell">
      <NavigationPane
        documents={documents}
        selectedDocumentId={selectedDocument?.id ?? null}
        onCreateDocument={handleCreateDocument}
        onSelectDocument={handleSelectDocument}
      />
      <EditorPane
        document={selectedDocument}
        title={title}
        content={content}
        saveState={saveState}
        error={error}
        onTitleChange={(value) => {
          setTitle(value);
          markDirty();
        }}
        onContentChange={(value) => {
          setContent(value);
          markDirty();
        }}
        onSave={handleSave}
      />
      <MetadataPane
        document={selectedDocument}
        notes={notes}
        status={status}
        favorite={favorite}
        characterCount={characterCount}
        wordCount={wordCount}
        onNotesChange={(value) => {
          setNotes(value);
          markDirty();
        }}
        onStatusChange={(value) => {
          setStatus(value);
          markDirty();
        }}
        onFavoriteChange={(value) => {
          setFavorite(value);
          markDirty();
        }}
      />
    </main>
  );
}
