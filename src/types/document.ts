export type ContentFormat = 'plain' | 'markdown' | 'rich';
export type DocumentStatus = 'draft' | 'active' | 'to_review' | 'final' | 'archived';

export interface TextDocument {
  id: number;
  title: string;
  content: string;
  content_format: ContentFormat;
  status: DocumentStatus;
  favorite: number;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  deleted_at: string | null;
  notes: string;
}

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentInput {
  title: string;
  content: string;
  notes: string;
  status: DocumentStatus;
  favorite: boolean;
  folder_id: number | null;
}
