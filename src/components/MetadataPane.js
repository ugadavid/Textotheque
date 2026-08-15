import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const statuses = ['draft', 'active', 'to_review', 'final', 'archived'];
function formatDate(value) {
    if (!value) {
        return '-';
    }
    return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
function folderLabel(folder, folders) {
    const parents = [];
    let current = folder;
    while (current.parent_id !== null) {
        const parent = folders.find((candidate) => candidate.id === current.parent_id);
        if (!parent) {
            break;
        }
        parents.unshift(parent.name);
        current = parent;
    }
    return parents.length > 0 ? `${parents.join(' / ')} / ${folder.name}` : folder.name;
}
export default function MetadataPane({ document, folders, notes, status, favorite, folderId, isDeleted, characterCount, wordCount, onNotesChange, onStatusChange, onFavoriteChange, onFolderChange, }) {
    return (_jsxs("aside", { className: "pane metadata-pane", children: [_jsx("div", { className: "pane-header metadata-header", children: _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Document" }), _jsx("h2", { children: "Metadonnees" })] }) }), !document ? (_jsx("p", { className: "empty-state", children: "Selectionnez un texte pour afficher ses informations." })) : (_jsxs("div", { className: "metadata-content", children: [_jsxs("dl", { className: "metadata-list", children: [_jsxs("div", { children: [_jsx("dt", { children: "ID" }), _jsx("dd", { children: document.id })] }), _jsxs("div", { children: [_jsx("dt", { children: "Format" }), _jsx("dd", { children: document.content_format })] }), _jsxs("div", { children: [_jsx("dt", { children: "Cree" }), _jsx("dd", { children: formatDate(document.created_at) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Modifie" }), _jsx("dd", { children: formatDate(document.updated_at) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Derniere ouverture" }), _jsx("dd", { children: formatDate(document.last_opened_at) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Caracteres" }), _jsx("dd", { children: characterCount })] }), _jsxs("div", { children: [_jsx("dt", { children: "Mots" }), _jsx("dd", { children: wordCount })] })] }), _jsxs("label", { className: "field-label", children: ["Dossier", _jsxs("select", { value: folderId ?? '', onChange: (event) => onFolderChange(event.target.value === '' ? null : Number(event.target.value)), disabled: isDeleted, children: [_jsx("option", { value: "", children: "Non classe" }), folders.map((folder) => (_jsx("option", { value: folder.id, children: folderLabel(folder, folders) }, folder.id)))] })] }), _jsxs("label", { className: "field-label", children: ["Statut", _jsx("select", { value: status, onChange: (event) => onStatusChange(event.target.value), disabled: isDeleted, children: statuses.map((statusOption) => (_jsx("option", { value: statusOption, children: statusOption }, statusOption))) })] }), _jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: favorite, onChange: (event) => onFavoriteChange(event.target.checked), disabled: isDeleted }), "Favori"] }), _jsxs("label", { className: "field-label", children: ["Notes internes", _jsx("textarea", { className: "notes-editor", value: notes, onChange: (event) => onNotesChange(event.target.value), placeholder: "Notes courtes...", disabled: isDeleted })] })] }))] }));
}
