export async function listDocuments() {
    return window.textotheque.listDocuments();
}
export async function createDocument() {
    return window.textotheque.createDocument();
}
export async function selectDocument(id) {
    return window.textotheque.markOpened(id);
}
export async function saveDocument(id, input) {
    return window.textotheque.updateDocument(id, input);
}
