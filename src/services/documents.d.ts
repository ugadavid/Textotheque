import type { DocumentInput, TextDocument } from '../types/document';
export declare function listDocuments(): Promise<TextDocument[]>;
export declare function createDocument(): Promise<TextDocument>;
export declare function selectDocument(id: number): Promise<TextDocument | null>;
export declare function saveDocument(id: number, input: DocumentInput): Promise<TextDocument>;
