import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
const UNTITLED_FALLBACK = 'Sans titre';
const COLLAPSED_FOLDERS_KEY = 'textotheque:collapsed-folders:v1';
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
function buildFolderRows(folders, collapsedFolderIds, parentId = null, depth = 0) {
    return folders
        .filter((folder) => folder.parent_id === parentId)
        .flatMap((folder) => [
        { ...folder, depth },
        ...(collapsedFolderIds.has(folder.id) ? [] : buildFolderRows(folders, collapsedFolderIds, folder.id, depth + 1)),
    ]);
}
function displayTitle(document) {
    return document.title.trim() || UNTITLED_FALLBACK;
}
function loadCollapsedFolderIds() {
    try {
        const stored = window.localStorage.getItem(COLLAPSED_FOLDERS_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'number')) : new Set();
    }
    catch {
        return new Set();
    }
}
function folderAncestorIds(folders, folderId) {
    const ancestors = [];
    let currentFolder = folders.find((folder) => folder.id === folderId) ?? null;
    while (currentFolder?.parent_id !== null && currentFolder?.parent_id !== undefined) {
        ancestors.unshift(currentFolder.parent_id);
        currentFolder = folders.find((folder) => folder.id === currentFolder?.parent_id) ?? null;
    }
    return ancestors;
}
export default function NavigationPane({ documents, allDocuments, folders, currentView, selectedFolderId, activeCount, unfiledCount, folderDocumentCounts, trashCount, totalDocuments, searchQuery, selectedDocumentId, dirtyDocumentId, onViewChange, onSearchChange, onClearSearch, onCreateDocument, onCreateFolder, onRenameFolder, onSelectDocument, onEmptyTrash, }) {
    const [editingFolderId, setEditingFolderId] = useState(null);
    const [editingFolderName, setEditingFolderName] = useState('');
    const [collapsedFolderIds, setCollapsedFolderIds] = useState(() => loadCollapsedFolderIds());
    const hasSearch = searchQuery.trim().length > 0;
    const folderRows = useMemo(() => buildFolderRows(folders, collapsedFolderIds), [collapsedFolderIds, folders]);
    const currentFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
    const unfiledDocuments = allDocuments.filter((document) => document.folder_id === null);
    const showClassicDocumentList = hasSearch || currentView === 'all' || currentView === 'trash';
    const summaryLabel = hasSearch
        ? 'Resultats'
        : currentView === 'trash'
            ? 'Corbeille'
            : currentView === 'unfiled'
                ? 'Non classes'
                : currentView === 'folder'
                    ? currentFolder?.name ?? 'Dossier'
                    : 'Tous les textes';
    useEffect(() => {
        window.localStorage.setItem(COLLAPSED_FOLDERS_KEY, JSON.stringify([...collapsedFolderIds]));
    }, [collapsedFolderIds]);
    useEffect(() => {
        const selectedDocument = allDocuments.find((document) => document.id === selectedDocumentId) ?? null;
        const folderToReveal = selectedDocument?.folder_id ?? selectedFolderId;
        if (folderToReveal === null || folderToReveal === undefined) {
            return;
        }
        const idsToOpen = [...folderAncestorIds(folders, folderToReveal), folderToReveal];
        setCollapsedFolderIds((current) => {
            if (idsToOpen.every((id) => !current.has(id))) {
                return current;
            }
            const next = new Set(current);
            idsToOpen.forEach((id) => next.delete(id));
            return next;
        });
    }, [allDocuments, folders, selectedDocumentId, selectedFolderId]);
    function toggleFolder(folderId) {
        setCollapsedFolderIds((current) => {
            const next = new Set(current);
            if (next.has(folderId)) {
                next.delete(folderId);
            }
            else {
                next.add(folderId);
            }
            return next;
        });
    }
    return (_jsxs("aside", { className: "pane navigation-pane", children: [_jsxs("div", { className: "pane-header", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Textotheque" }), _jsx("h1", { children: "Documents" })] }), _jsx("button", { className: "icon-button", type: "button", onClick: onCreateDocument, title: "Nouveau document - Ctrl+N", children: "+" })] }), _jsxs("div", { className: "nav-summary", children: [_jsx("span", { children: summaryLabel }), _jsx("strong", { children: hasSearch ? `${documents.length}/${totalDocuments}` : totalDocuments })] }), _jsxs("div", { className: "nav-view-switch", "aria-label": "Vue des documents", children: [_jsxs("button", { className: currentView === 'all' ? 'nav-view-button selected' : 'nav-view-button', type: "button", onClick: () => onViewChange('all', null), children: ["Tous les textes ", _jsx("span", { children: activeCount })] }), _jsxs("button", { className: currentView === 'trash' ? 'nav-view-button selected' : 'nav-view-button', type: "button", onClick: () => onViewChange('trash', null), children: ["Corbeille ", _jsx("span", { children: trashCount })] })] }), currentView === 'trash' ? (_jsx("button", { className: "empty-trash-button", type: "button", onClick: onEmptyTrash, disabled: trashCount === 0, children: "Vider la corbeille" })) : null, _jsxs("section", { className: "folder-section", "aria-label": "Dossiers virtuels", children: [_jsxs("div", { className: "folder-section-header", children: [_jsx("span", { children: "Dossiers" }), _jsxs("div", { className: "folder-actions", children: [_jsx("button", { type: "button", onClick: () => onCreateFolder(null), title: "Nouveau dossier racine", children: "+" }), currentView === 'folder' && selectedFolderId !== null ? (_jsx("button", { type: "button", onClick: () => onCreateFolder(selectedFolderId), title: "Nouveau sous-dossier", children: "+/" })) : null] })] }), folderRows.length === 0 ? (_jsx("p", { className: "folder-empty", children: "Aucun dossier." })) : (_jsx("div", { className: "folder-list", children: folderRows.map((folder) => {
                            const isSelected = currentView === 'folder' && selectedFolderId === folder.id;
                            const isEditing = editingFolderId === folder.id;
                            const isCollapsed = collapsedFolderIds.has(folder.id);
                            const documentCount = folderDocumentCounts[folder.id] ?? 0;
                            const folderDocuments = hasSearch
                                || isCollapsed
                                ? []
                                : allDocuments.filter((document) => document.folder_id === folder.id);
                            function startRename() {
                                setEditingFolderId(folder.id);
                                setEditingFolderName(folder.name);
                            }
                            function commitRename(nextName = editingFolderName) {
                                onRenameFolder(folder.id, nextName);
                                setEditingFolderId(null);
                                setEditingFolderName('');
                            }
                            return (_jsxs("div", { className: "folder-row", children: [isEditing ? (_jsx("input", { className: "folder-name-input", value: editingFolderName, autoFocus: true, style: { marginLeft: `${folder.depth * 14}px` }, onChange: (event) => setEditingFolderName(event.target.value), onBlur: (event) => commitRename(event.currentTarget.value), onKeyDown: (event) => {
                                            if (event.key === 'Enter') {
                                                event.currentTarget.blur();
                                            }
                                            if (event.key === 'Escape') {
                                                setEditingFolderId(null);
                                                setEditingFolderName('');
                                            }
                                        } })) : (_jsxs(_Fragment, { children: [_jsx("button", { className: "folder-toggle-button", type: "button", style: { marginLeft: `${folder.depth * 14}px` }, onClick: () => toggleFolder(folder.id), title: isCollapsed ? 'Deplier le dossier' : 'Replier le dossier', "aria-label": isCollapsed ? 'Deplier le dossier' : 'Replier le dossier', children: isCollapsed ? '>' : 'v' }), _jsxs("button", { className: isSelected ? 'folder-button selected' : 'folder-button', type: "button", onClick: () => onViewChange('folder', folder.id), onDoubleClick: startRename, title: "Double-clic pour renommer", children: [_jsxs("span", { children: [folder.depth > 0 ? '- ' : '', folder.name] }), _jsx("strong", { children: documentCount })] }), isSelected ? (_jsx("button", { className: "folder-rename-button", type: "button", onClick: startRename, children: "Renommer" })) : null] })), folderDocuments.map((document) => {
                                        const isDocumentSelected = selectedDocumentId === document.id;
                                        const isDirty = dirtyDocumentId === document.id;
                                        return (_jsx("button", { className: isDocumentSelected
                                                ? 'tree-document-button selected'
                                                : 'tree-document-button', type: "button", style: { marginLeft: `${18 + folder.depth * 14}px` }, onClick: () => onSelectDocument(document.id, 'folder', folder.id), children: _jsxs("span", { children: [isDirty ? _jsx("span", { className: "dirty-marker", children: "*" }) : null, document.favorite ? '* ' : '', displayTitle(document)] }) }, document.id));
                                    })] }, folder.id));
                        }) }))] }), !hasSearch ? (_jsxs("section", { className: "unfiled-tree-section", "aria-label": "Documents non classes", children: [_jsxs("button", { className: currentView === 'unfiled' ? 'nav-view-button selected' : 'nav-view-button', type: "button", onClick: () => onViewChange('unfiled', null), children: ["Non classes ", _jsx("span", { children: unfiledCount })] }), _jsx("div", { className: "tree-document-list", children: unfiledDocuments.length === 0 ? (_jsx("p", { className: "folder-empty", children: "Aucun document non classe." })) : (unfiledDocuments.map((document) => {
                            const isDocumentSelected = selectedDocumentId === document.id;
                            const isDirty = dirtyDocumentId === document.id;
                            return (_jsx("button", { className: isDocumentSelected ? 'tree-document-button selected' : 'tree-document-button', type: "button", onClick: () => onSelectDocument(document.id, 'unfiled', null), children: _jsxs("span", { children: [isDirty ? _jsx("span", { className: "dirty-marker", children: "*" }) : null, document.favorite ? '* ' : '', displayTitle(document)] }) }, document.id));
                        })) })] })) : null, _jsxs("label", { className: "search-field", children: [_jsx("span", { children: "Recherche" }), _jsxs("div", { className: "search-input-row", children: [_jsx("input", { type: "search", value: searchQuery, onChange: (event) => onSearchChange(event.target.value), placeholder: "Titre ou contenu...", "aria-label": "Rechercher dans les documents", title: "Rechercher - Ctrl+F" }), hasSearch ? (_jsx("button", { className: "clear-search-button", type: "button", onClick: onClearSearch, title: "Vider la recherche", children: "x" })) : null] })] }), showClassicDocumentList ? (_jsx("div", { className: "document-list", "aria-label": "Liste des documents", children: documents.length === 0 ? (_jsx("p", { className: "empty-state", children: hasSearch ? 'Aucun document trouve.' : currentView === 'trash' ? 'La corbeille est vide.' : 'Aucun document pour le moment.' })) : (documents.map((document) => {
                    const isDirty = dirtyDocumentId === document.id;
                    return (_jsxs("button", { className: document.id === selectedDocumentId ? 'document-item selected' : 'document-item', type: "button", onClick: () => onSelectDocument(document.id), children: [_jsxs("span", { className: "document-title", children: [isDirty ? _jsx("span", { className: "dirty-marker", children: "*" }) : null, document.favorite ? '* ' : '', displayTitle(document)] }), _jsxs("span", { className: "document-meta", children: [document.status, " - ", formatDate(document.updated_at)] })] }, document.id));
                })) })) : null] }));
}
