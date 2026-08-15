import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
const saveLabels = {
    idle: 'Pret',
    dirty: 'Modifie',
    saving: 'Sauvegarde...',
    saved: 'Sauvegarde',
    error: 'Erreur',
};
export default function EditorPane({ document, title, content, saveState, isDirty, error, isDeleted, onTitleChange, onContentChange, onSave, onTrash, onRestore, }) {
    if (!document) {
        return (_jsxs("section", { className: "pane editor-pane empty-editor", children: [_jsx("h2", { children: "Aucun document selectionne" }), _jsx("p", { children: "Creez un premier texte depuis le volet gauche." })] }));
    }
    return (_jsxs("section", { className: "pane editor-pane", children: [_jsxs("header", { className: "editor-toolbar", children: [_jsxs("div", { className: "title-row", children: [isDirty ? _jsx("span", { className: "title-dirty-marker", "aria-label": "Modifications non sauvegardees", children: "*" }) : null, _jsx("input", { className: "title-input", value: title, onChange: (event) => onTitleChange(event.target.value), placeholder: "Sans titre", "aria-label": "Titre du document", disabled: isDeleted })] }), _jsxs("div", { className: "save-controls", children: [_jsx("span", { className: `save-state ${saveState}`, children: saveLabels[saveState] }), isDeleted ? (_jsx("button", { className: "primary-button", type: "button", onClick: onRestore, children: "Restaurer" })) : (_jsxs(_Fragment, { children: [_jsx("button", { className: "secondary-button trash-button", type: "button", onClick: onTrash, children: "Corbeille" }), _jsx("button", { className: "primary-button", type: "button", onClick: onSave, disabled: saveState === 'saving', title: "Sauvegarder - Ctrl+S", children: "Sauvegarder" })] }))] })] }), error ? _jsx("p", { className: "error-message", children: error }) : null, _jsx("textarea", { className: "content-editor", value: content, onChange: (event) => onContentChange(event.target.value), placeholder: "Ecrire ici...", spellCheck: "true", disabled: isDeleted })] }));
}
