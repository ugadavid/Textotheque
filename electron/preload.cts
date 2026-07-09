import type { DocumentInput, TextDocument } from './database.js';

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const api = {
  listDocuments: (): Promise<TextDocument[]> => ipcRenderer.invoke('documents:list'),
  createDocument: (): Promise<TextDocument> => ipcRenderer.invoke('documents:create'),
  getDocument: (id: number): Promise<TextDocument | null> => ipcRenderer.invoke('documents:get', id),
  updateDocument: (id: number, input: DocumentInput): Promise<TextDocument> =>
    ipcRenderer.invoke('documents:update', id, input),
  markOpened: (id: number): Promise<TextDocument> => ipcRenderer.invoke('documents:mark-opened', id),
};

contextBridge.exposeInMainWorld('textotheque', api);

export type TextothequeApi = typeof api;
