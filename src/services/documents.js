export async function listDocuments() {
    return window.textotheque.listDocuments();
}
export async function listDeletedDocuments() {
    return window.textotheque.listDeletedDocuments();
}
export async function listFolders() {
    return window.textotheque.listFolders();
}
export async function createFolder(parentId = null) {
    return window.textotheque.createFolder(parentId);
}
export async function renameFolder(id, name) {
    return window.textotheque.renameFolder(id, name);
}
export async function createDocument(folderId = null) {
    return window.textotheque.createDocument(folderId);
}
export async function selectDocument(id) {
    return window.textotheque.markOpened(id);
}
export async function saveDocument(id, input) {
    return window.textotheque.updateDocument(id, input);
}
export async function trashDocument(id) {
    return window.textotheque.trashDocument(id);
}
export async function restoreDocument(id) {
    return window.textotheque.restoreDocument(id);
}
export async function emptyTrash() {
    return window.textotheque.emptyTrash();
}
