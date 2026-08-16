import type { CatalogDocument, CatalogSortDirection, CatalogSortField } from './catalog';

export type SearchTextField = 'title' | 'content' | 'notes';
export type SearchMatchMode = 'all' | 'any' | 'phrase';
export type CreatedPeriod = 'all' | 'last7days' | 'last15days' | 'last30days' | 'thisYear';
export type SearchSortField = 'relevance' | CatalogSortField;

export interface SearchDocumentsOptions {
  query: string;
  fields: SearchTextField[];
  matchMode: SearchMatchMode;
  createdPeriod: CreatedPeriod;
  sortBy: SearchSortField;
  direction: CatalogSortDirection;
}

export interface SearchDocument extends CatalogDocument {
  snippet: string | null;
  relevance: number | null;
}
