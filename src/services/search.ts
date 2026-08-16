import type { SearchDocument, SearchDocumentsOptions } from '../types/search';

export async function searchDocuments(options: SearchDocumentsOptions): Promise<SearchDocument[]> {
  return window.textotheque.searchDocuments(options);
}
