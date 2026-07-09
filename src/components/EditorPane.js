import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const saveLabels = {
    idle: 'Pret',
    dirty: 'Modifie',
    saving: 'Sauvegarde...',
    saved: 'Sauvegarde',
    error: 'Erreur',
};
export default function EditorPane({ document, title, content, saveState, error, onTitleChange, onContentChange, onSave, }) {
    if (!document) {
        return (_jsxs("section", { className: "pane editor-pane empty-editor", children: [_jsx("h2", { children: "Aucun document selectionne" }), _jsx("p", { children: "Creez un premier texte depuis le volet gauche." })] }));
    }
    return (_jsxs("section", { className: "pane editor-pane", children: [_jsxs("header", { className: "editor-toolbar", children: [_jsx("input", { className: "title-input", value: title, onChange: (event) => onTitleChange(event.target.value), placeholder: "Sans titre", "aria-label": "Titre du document" }), _jsxs("div", { className: "save-controls", children: [_jsx("span", { className: `save-state ${saveState}`, children: saveLabels[saveState] }), _jsx("button", { className: "primary-button", type: "button", onClick: onSave, disabled: saveState === 'saving', children: "Sauvegarder" })] })] }), error ? _jsx("p", { className: "error-message", children: error }) : null, _jsx("textarea", { className: "content-editor", value: content, onChange: (event) => onContentChange(event.target.value), placeholder: "Ecrire ici...", spellCheck: "true" })] }));
}
