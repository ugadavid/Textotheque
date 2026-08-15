import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const saveLabels = {
    idle: 'Pret',
    dirty: 'Modifie',
    saving: 'Sauvegarde...',
    saved: 'Sauvegarde',
    error: 'Erreur',
};
export default function StatusBar({ totalDocuments, visibleDocuments, searchQuery, currentView, contextLabel, trashCount, selectedDocument, status, saveState, characterCount, wordCount, version, }) {
    const trimmedSearch = searchQuery.trim();
    return (_jsxs("footer", { className: "status-bar", "aria-label": "Statut de Textotheque", children: [_jsx("span", { children: "Textotheque" }), _jsx("span", { children: contextLabel }), _jsxs("span", { children: [totalDocuments, " documents"] }), currentView !== 'trash' ? _jsxs("span", { children: ["Corbeille: ", trashCount] }) : null, trimmedSearch ? _jsxs("span", { children: [visibleDocuments, " affiches"] }) : null, trimmedSearch ? _jsxs("span", { children: ["Recherche: \"", trimmedSearch, "\""] }) : null, _jsx("span", { children: selectedDocument ? `Document ${selectedDocument.id}` : 'Aucune selection' }), _jsx("span", { children: selectedDocument?.content_format ?? 'plain' }), _jsx("span", { children: status }), _jsx("span", { children: saveLabels[saveState] }), _jsxs("span", { children: [wordCount, " mots"] }), _jsxs("span", { children: [characterCount, " caracteres"] }), _jsx("span", { children: "SQLite OK" }), _jsxs("span", { children: ["v", version] })] }));
}
