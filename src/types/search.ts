import type { CatalogDocument, CatalogSortDirection, CatalogSortField } from './catalog';
import type { DocumentStatus } from './document';

export type SearchTextField = 'title' | 'content' | 'notes';
export type SearchMatchMode = 'all' | 'any' | 'phrase';
export type DatePeriod = 'all' | 'last7days' | 'last15days' | 'last30days' | 'thisYear' | 'custom';
export type SearchSortField = 'relevance' | CatalogSortField;

export interface SearchDateFilter {
  period: DatePeriod;
  from: string | null;
  to: string | null;
}

export interface SearchFolderSelection {
  folderIds: number[];
  includeUnclassified: boolean;
}

export interface SearchDocumentsOptions {
  query: string;
  fields: SearchTextField[];
  matchMode: SearchMatchMode;
  folderSelection: SearchFolderSelection;
  statuses: DocumentStatus[];
  favoriteOnly: boolean;
  created: SearchDateFilter;
  modified: SearchDateFilter;
  sortBy: SearchSortField;
  direction: CatalogSortDirection;
}

export interface SearchDocument extends CatalogDocument {
  snippet: string | null;
  relevance: number | null;
}
