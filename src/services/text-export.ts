import type { TextExportDraft, TextExportResult } from '../types/text-export';

export async function exportTextDocument(draft: TextExportDraft): Promise<TextExportResult> {
  return window.textotheque.exportTextDocument(draft);
}

export async function setDocumentExportAvailable(available: boolean): Promise<void> {
  return window.textotheque.setDocumentExportAvailable(available);
}
