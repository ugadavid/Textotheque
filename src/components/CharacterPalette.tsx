import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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
const initialCharacters = [...initialFavorites, ...Object.values(categories).flat()];
type Position = { x: number; y: number };
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
    const favorites = list(data?.favorites, initialFavorites);
    // In 056 a removed personal character could be starred again from Recents.
    const personal = [...new Set([...list(data?.personal, []), ...favorites.filter(g => !initialCharacters.includes(g))])];
    const position: Position | undefined = Number.isFinite(data?.position?.x) && Number.isFinite(data?.position?.y)
      ? { x: data.position.x, y: data.position.y } : undefined;
    return {
      favorites, personal, position,
      recent: list(data?.recent, []).slice(0, 12),
    };
  } catch {
    return { favorites: initialFavorites, personal: [] as string[], recent: [] as string[], position: undefined };
  }
}

interface Props {
  editable: boolean;
  onInsert: (text: string) => boolean;
  onClose: () => void;
}

export default function CharacterPalette({ editable, onInsert, onClose }: Props) {
  const [prefs, setPrefs] = useState(loadPreferences);
  const [category, setCategory] = useState('Mes caractères');
  const panel = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<(Position & { pointerId: number }) | null>(null);
  const [position, setPosition] = useState(prefs.position);
  const [entry, setEntry] = useState<string | null>(null);
  const groups: Record<string, string[]> = {
    'Mes caractères': [...new Set([...prefs.personal, ...initialCharacters])],
    Favoris: prefs.favorites, Récents: prefs.recent, ...categories,
  };

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch { /* Profil en lecture seule. */ }
  }, [prefs]);

  function bounded({ x, y }: Position): Position {
    const rect = panel.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(x, window.innerWidth - rect.width)),
      y: Math.max(0, Math.min(y, window.innerHeight - rect.height)) };
  }
  useLayoutEffect(() => {
    function fit() {
      setPosition(old => {
        if (!old) return old;
        const next = bounded(old);
        return next.x === old.x && next.y === old.y ? old : next;
      });
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(panel.current!);
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  useEffect(() => {
    function move(e: PointerEvent) {
      const offset = drag.current;
      if (!offset || e.pointerId !== offset.pointerId) return;
      const next = bounded({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      setPosition(next);
      if (e.type === 'pointerup') {
        drag.current = null;
        setPrefs(p => ({ ...p, position: next }));
      }
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', move);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', move);
    };
  }, []);

  function toggleFavorite(glyph: string) {
    setPrefs(p => p.favorites.includes(glyph)
      ? { ...p, favorites: p.favorites.filter(item => item !== glyph) }
      : { ...p, favorites: [...p.favorites, glyph],
          personal: initialCharacters.includes(glyph) || p.personal.includes(glyph) ? p.personal : [...p.personal, glyph] });
  }

  return <aside ref={panel} className="character-palette" aria-label="Caractères spéciaux"
    style={position && { left: position.x, top: position.y, right: 'auto' }}>
    <header onPointerDown={e => {
      if (!e.isPrimary || e.button !== 0 || (e.target as Element).closest('button')) return;
      e.preventDefault();
      const rect = panel.current!.getBoundingClientRect();
      drag.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, pointerId: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerCancel={() => { drag.current = null; }}><strong>Caractères spéciaux</strong>
      <button type="button" onClick={onClose} aria-label="Fermer la palette">×</button>
    </header>
    <div className="character-controls">
      <select autoFocus aria-label="Catégorie de caractères" value={category} onChange={e => setCategory(e.target.value)}>
        {Object.keys(groups).map(name => <option key={name}>{name}</option>)}
      </select>
    </div>
    {!editable && <small>Ouvrez un texte modifiable pour insérer un caractère.</small>}
    <div className="character-grid" ref={grid}>
      {groups[category].map(glyph => {
        const label = names[glyph] ? glyph + ' — ' + names[glyph] : glyph;
        return <div key={glyph}>
          <button className="character-tile" type="button" disabled={!editable}
            title={label} aria-label={label} onClick={() => {
              if (editable && onInsert(glyph)) setPrefs(p => ({ ...p, recent: [glyph, ...p.recent.filter(item => item !== glyph)].slice(0, 12) }));
            }}>{glyph}</button>
          <button className="character-star" type="button" aria-label={'Favori ' + glyph}
            aria-pressed={prefs.favorites.includes(glyph)} onClick={() => toggleFavorite(glyph)}
            title={prefs.favorites.includes(glyph) ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            {prefs.favorites.includes(glyph) ? '★' : '☆'}
          </button>
          {category === 'Mes caractères' && prefs.personal.includes(glyph) && <button className="character-remove" type="button"
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
        setPrefs(p => ({ ...p, personal: [...new Set([entry, ...p.personal])] }));
        setCategory('Mes caractères');
        setEntry(null);
        grid.current?.scrollTo(0, 0);
      }}>
        <input autoFocus aria-label="Caractère à ajouter" placeholder="Saisir ou coller un caractère"
          value={entry} onChange={e => setEntry(e.target.value)} />
        <button type="submit" disabled={!isCharacter(entry)}>Ajouter</button>
        <button type="button" aria-label="Annuler l’ajout" onClick={() => setEntry(null)}>×</button>
        {entry && !isCharacter(entry) && <small>Saisissez un seul caractère.</small>}
      </form>}
  </aside>;
}
