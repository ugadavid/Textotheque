import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function formatDate(value) {
    if (!value) {
        return 'Jamais ouvert';
    }
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}
export default function NavigationPane({ documents, selectedDocumentId, onCreateDocument, onSelectDocument, }) {
    return (_jsxs("aside", { className: "pane navigation-pane", children: [_jsxs("div", { className: "pane-header", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Textotheque" }), _jsx("h1", { children: "Documents" })] }), _jsx("button", { className: "icon-button", type: "button", onClick: onCreateDocument, title: "Nouveau document", children: "+" })] }), _jsxs("div", { className: "nav-summary", children: [_jsx("span", { children: "Tous les textes" }), _jsx("strong", { children: documents.length })] }), _jsx("div", { className: "document-list", "aria-label": "Liste des documents", children: documents.length === 0 ? (_jsx("p", { className: "empty-state", children: "Aucun document pour le moment." })) : (documents.map((document) => (_jsxs("button", { className: document.id === selectedDocumentId ? 'document-item selected' : 'document-item', type: "button", onClick: () => onSelectDocument(document.id), children: [_jsxs("span", { className: "document-title", children: [document.favorite ? '* ' : '', document.title] }), _jsxs("span", { className: "document-meta", children: [document.status, " \u00B7 ", formatDate(document.updated_at)] })] }, document.id)))) })] }));
}
