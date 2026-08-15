export interface TextExportDraft {
  title: string;
  content: string;
}

export interface TextExportResult {
  canceled: boolean;
  fileName: string | null;
}

export type FileMenuAction = { action: 'export-text' };
