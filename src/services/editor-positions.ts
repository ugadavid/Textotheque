export interface EditorPosition {
  start: number;
  end: number;
  direction: HTMLTextAreaElement['selectionDirection'];
  scrollTop: number;
  scrollLeft: number;
}

const keyPrefix = 'textotheque:editor-positions:v1:';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isScroll(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function loadEditorPositions(libraryPath?: string): Map<number, EditorPosition> {
  const positions = new Map<number, EditorPosition>();
  if (!libraryPath) return positions;
  try {
    const raw = localStorage.getItem(keyPrefix + libraryPath);
    if (!raw) return positions;
    const entries: unknown = JSON.parse(raw);
    if (!isRecord(entries)) return positions;
    for (const [key, value] of Object.entries(entries)) {
      const id = Number(key);
      if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== key || !isRecord(value)) continue;
      const { start, end, direction, scrollTop, scrollLeft } = value;
      if (!isOffset(start) || !isOffset(end) || end < start ||
          (direction !== 'none' && direction !== 'forward' && direction !== 'backward') ||
          !isScroll(scrollTop) || !isScroll(scrollLeft)) continue;
      positions.set(id, { start, end, direction, scrollTop, scrollLeft });
    }
  } catch {
    // A missing storage area or malformed JSON leaves the session map usable.
  }
  return positions;
}

export function persistEditorPositions(libraryPath: string | undefined, positions: Map<number, EditorPosition>): void {
  if (!libraryPath) return;
  try {
    localStorage.setItem(keyPrefix + libraryPath, JSON.stringify(Object.fromEntries(positions)));
  } catch {
    // A full or unavailable preferences store must not block navigation or closing.
  }
}
