import { useEffect, useState } from 'react';

const initialFavorites = '😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸'.split(' ');
const categories: Record<string, string[]> = {
  Typographie: '— – … « » “ ” ‘ ’ ° №'.split(' '),
  Flèches: '← → ↑ ↓ ↔ ↕ ⇒ ⇐ ⇔'.split(' '),
  'Symboles pratiques': '✓ ✔ ✗ ✘ ★ ☆ ♥ ♡ ⚠ ⚙ ⌛ ⏱'.split(' '),
  'Marqueurs visuels': '• ◦ ▪ ▫ ◆ ◇ ○ ● □ ■'.split(' '),
  'Maths / technique': '± × ÷ ≠ ≤ ≥ ≈ ∞'.split(' '),
};
const names: Record<string, string> = {
  '😂': 'rire aux larmes', '🤣': 'fou rire', '🚀': 'fusée', '💙': 'cœur bleu', '🧠': 'cerveau',
  '🗃️': 'boîte à fiches', '💝': 'cœur enrubanné', '🪄': 'baguette magique', '🧶': 'pelote', '📦': 'colis', '🐸': 'grenouille',
};
const storageKey = 'textotheque:special-characters:v1';
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
function isCharacter(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && !/\p{Cc}/u.test(value)
    && segmenter.segment(value).containing(0)?.segment === value;
}

function loadPreferences() {
  const list = (value: unknown, fallback: string[]) =>
    Array.isArray(value) ? [...new Set(value.filter(isCharacter))] : fallback;
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return {
      favorites: list(data?.favorites, initialFavorites),
      personal: list(data?.personal, []),
      recent: list(data?.recent, []).slice(0, 12),
    };
  } catch {
    return { favorites: initialFavorites, personal: [] as string[], recent: [] as string[] };
  }
}

interface Props {
  editable: boolean;
  onInsert: (text: string) => boolean;
  onClose: () => void;
}

export default function CharacterPalette({ editable, onInsert, onClose }: Props) {
  const [prefs, setPrefs] = useState(loadPreferences);
  const [category, setCategory] = useState('Favoris');
  const [editing, setEditing] = useState(false);
  const [entry, setEntry] = useState<string | null>(null);
  const groups: Record<string, string[]> = {
    Favoris: prefs.favorites, Récents: prefs.recent, 'Mes caractères': prefs.personal, ...categories,
  };

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch { /* Profil en lecture seule. */ }
  }, [prefs]);

  function choose(glyph: string) {
    if (editing) {
      setPrefs(p => ({ ...p, favorites: p.favorites.includes(glyph)
        ? p.favorites.filter(item => item !== glyph) : [...p.favorites, glyph] }));
    } else if (editable && onInsert(glyph)) {
      setPrefs(p => ({ ...p, recent: [glyph, ...p.recent.filter(item => item !== glyph)].slice(0, 12) }));
    }
  }

  return <aside className="character-palette" aria-label="Caractères spéciaux">
    <header><strong>Caractères spéciaux</strong>
      <button type="button" onClick={onClose} aria-label="Fermer la palette">×</button>
    </header>
    <div className="character-controls">
      <select autoFocus aria-label="Catégorie de caractères" value={category} onChange={e => setCategory(e.target.value)}>
        {Object.keys(groups).map(name => <option key={name}>{name}</option>)}
      </select>
      <button type="button" aria-pressed={editing} onClick={() => setEditing(!editing)}>
        {editing ? 'Terminer' : 'Organiser'}
      </button>
    </div>
    {editing ? <small>Cliquez pour ajouter ou retirer un favori.{category === 'Mes caractères' && ' × supprime un caractère personnel.'}</small>
      : !editable && <small>Ouvrez un texte modifiable pour insérer un caractère.</small>}
    <div className="character-grid">
      {groups[category].map(glyph => {
        const label = names[glyph] ? glyph + ' — ' + names[glyph] : glyph;
        return <div key={glyph}>
          <button className="character-tile" type="button" disabled={!editable && !editing}
            title={label} aria-label={label} aria-pressed={editing ? prefs.favorites.includes(glyph) : undefined}
            onClick={() => choose(glyph)}>{glyph}</button>
          {editing && category === 'Mes caractères' && <button className="character-remove" type="button"
            aria-label={'Supprimer ' + glyph} title="Supprimer de Mes caractères"
            onClick={() => setPrefs(p => ({ ...p, personal: p.personal.filter(v => v !== glyph),
              favorites: p.favorites.filter(v => v !== glyph) }))}>×</button>}
        </div>;
      })}
    </div>
    {!groups[category].length && <small>Aucun caractère dans cette catégorie.</small>}
    {entry === null ? <button type="button" onClick={() => setEntry('')}>Ajouter un caractère…</button>
      : <form onSubmit={event => {
        event.preventDefault();
        if (!isCharacter(entry)) return;
        setPrefs(p => ({ ...p, personal: [...new Set([...p.personal, entry])] }));
        setCategory('Mes caractères');
        setEntry(null);
      }}>
        <input autoFocus aria-label="Caractère à ajouter" placeholder="Saisir ou coller un caractère"
          value={entry} onChange={e => setEntry(e.target.value)} />
        <button type="submit" disabled={!isCharacter(entry)}>Ajouter</button>
        <button type="button" aria-label="Annuler l’ajout" onClick={() => setEntry(null)}>×</button>
        {entry && !isCharacter(entry) && <small>Saisissez un seul caractère.</small>}
      </form>}
  </aside>;
}
