import type { DocumentStatus, SpecialDocumentRole } from './document';

export type CatalogSortField =
  | 'title'
  | 'folder'
  | 'status'
  | 'favorite'
  | 'created_at'
  | 'updated_at';

export type CatalogSortDirection = 'asc' | 'desc';

export interface DocumentCatalogOptions {
  sortBy: CatalogSortField;
  direction: CatalogSortDirection;
}

export interface CatalogDocument {
  id: number;
  title: string;
  folderId: number | null;
  folderName: string | null;
  status: DocumentStatus;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  specialRole: SpecialDocumentRole | null;
}
