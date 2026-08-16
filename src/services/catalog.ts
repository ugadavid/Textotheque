import type { CatalogDocument, DocumentCatalogOptions } from '../types/catalog';

export async function listDocumentCatalog(options: DocumentCatalogOptions): Promise<CatalogDocument[]> {
  return window.textotheque.listDocumentCatalog(options);
}
