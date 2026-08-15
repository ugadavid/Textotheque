import fs from 'node:fs';
import path from 'node:path';

export interface LibraryHistoryEntry {
  path: string;
  firstOpenedAt: string;
  lastOpenedAt: string;
}

export interface LibraryHistoryData {
  version: 1;
  lastActivePath: string | null;
  libraries: LibraryHistoryEntry[];
}

export interface KnownLibrary extends LibraryHistoryEntry {
  available: boolean;
}

function pathKey(libraryPath: string): string {
  const resolved = path.resolve(libraryPath);
  return process.platform === 'win32' ? resolved.toLocaleLowerCase('en-US') : resolved;
}

function isHistoryEntry(value: unknown): value is LibraryHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.path === 'string' && typeof entry.firstOpenedAt === 'string' && typeof entry.lastOpenedAt === 'string';
}

function emptyHistory(): LibraryHistoryData {
  return { version: 1, lastActivePath: null, libraries: [] };
}

export class LibraryHistoryRegistry {
  private data: LibraryHistoryData;

  constructor(
    readonly filePath: string,
    private readonly now: () => Date = () => new Date()
  ) {
    this.data = this.load();
  }

  private load(): LibraryHistoryData {
    if (!fs.existsSync(this.filePath)) return emptyHistory();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<LibraryHistoryData>;
      if (parsed.version !== 1 || !Array.isArray(parsed.libraries)) {
        throw new Error('Format de registre non pris en charge.');
      }
      if (!parsed.libraries.every(isHistoryEntry)) {
        throw new Error('Le registre contient une entrée invalide.');
      }
      const deduplicated = new Map<string, LibraryHistoryEntry>();
      for (const entry of parsed.libraries.filter(isHistoryEntry)) {
        const resolvedPath = path.resolve(entry.path);
        const key = pathKey(resolvedPath);
        const existing = deduplicated.get(key);
        deduplicated.set(key, existing ? {
          path: resolvedPath,
          firstOpenedAt: existing.firstOpenedAt < entry.firstOpenedAt ? existing.firstOpenedAt : entry.firstOpenedAt,
          lastOpenedAt: existing.lastOpenedAt > entry.lastOpenedAt ? existing.lastOpenedAt : entry.lastOpenedAt,
        } : { path: resolvedPath, firstOpenedAt: entry.firstOpenedAt, lastOpenedAt: entry.lastOpenedAt });
      }
      const libraries = [...deduplicated.values()];
      return {
        version: 1,
        lastActivePath: typeof parsed.lastActivePath === 'string' ? path.resolve(parsed.lastActivePath) : null,
        libraries,
      };
    } catch (error) {
      const preservedPath = `${this.filePath}.invalid-${this.now().toISOString().replace(/[:.]/g, '-')}`;
      try {
        fs.copyFileSync(this.filePath, preservedPath, fs.constants.COPYFILE_EXCL);
        console.error(`[Library history] Registre invalide préservé dans ${preservedPath}`, error);
      } catch (preserveError) {
        console.error('[Library history] Registre invalide, préservation impossible', error, preserveError);
      }
      return emptyHistory();
    }
  }

  getLastActivePath(): string | null {
    return this.data.lastActivePath;
  }

  getKnownLibraries(): KnownLibrary[] {
    return this.data.libraries
      .map((entry) => ({ ...entry, available: fs.existsSync(entry.path) }))
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  }

  recordActivation(libraryPath: string): void {
    const resolvedPath = path.resolve(libraryPath);
    const key = pathKey(resolvedPath);
    const timestamp = this.now().toISOString();
    const existing = this.data.libraries.find((entry) => pathKey(entry.path) === key);
    if (existing) {
      existing.path = resolvedPath;
      existing.lastOpenedAt = timestamp;
    } else {
      this.data.libraries.push({ path: resolvedPath, firstOpenedAt: timestamp, lastOpenedAt: timestamp });
    }
    this.data.lastActivePath = resolvedPath;
    this.writeAtomically();
  }

  private writeAtomically(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
    try {
      fs.writeFileSync(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(temporaryPath, this.filePath);
    } finally {
      if (fs.existsSync(temporaryPath)) {
        fs.unlinkSync(temporaryPath);
      }
    }
  }
}
