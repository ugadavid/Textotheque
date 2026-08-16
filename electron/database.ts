import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type ContentFormat = 'plain' | 'markdown' | 'rich';
export type DocumentStatus = 'draft' | 'active' | 'to_review' | 'final' | 'archived';
export type SpecialDocumentRole = 'todo';
export type CatalogSortField =
  | 'title'
  | 'folder'
  | 'status'
  | 'favorite'
  | 'created_at'
  | 'updated_at';
export type CatalogSortDirection = 'asc' | 'desc';

export interface DocumentCatalogOptions {
  sortBy: CatalogSortField;
  direction: CatalogSortDirection;
}

export interface CatalogDocument {
  id: number;
  title: string;
  folderId: number | null;
  folderName: string | null;
  status: DocumentStatus;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  specialRole: SpecialDocumentRole | null;
}

export interface TextDocument {
  id: number;
  title: string;
  content: string;
  content_format: ContentFormat;
  status: DocumentStatus;
  favorite: number;
  folder_id: number | null;
  special_role: SpecialDocumentRole | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  deleted_at: string | null;
  notes: string;
}

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentInput {
  title: string;
  content: string;
  notes: string;
  status: DocumentStatus;
  favorite: boolean;
  folder_id: number | null;
}

export const CURRENT_SCHEMA_VERSION = 3;
export const TEXTOTHEQUE_APPLICATION_ID = 0x5445584f;
export const MAX_AUTOMATIC_DOCUMENTS_PER_DAY = 99;

export type LibraryCompatibility = 'compatible' | 'legacy-textotheque' | 'too-new' | 'foreign' | 'invalid';

export interface LibraryInfo {
  path: string;
  fileName: string;
  applicationId: number;
  userVersion: number;
  isTextotheque: boolean;
}

export interface LibraryInspection {
  path: string;
  fileName: string;
  readable: boolean;
  applicationId: number | null;
  userVersion: number | null;
  isTextotheque: boolean;
  compatibility: LibraryCompatibility;
}

export interface LibraryBackupResult {
  canceled: boolean;
  path: string | null;
  fileName: string | null;
  error: 'same-source' | null;
}

export interface PreMigrationBackupResult {
  path: string;
  inspection: LibraryInspection;
}

function nowIso(date = new Date()): string {
  return date.toISOString();
}

export function localDocumentTitleDate(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export function isAutomaticDocumentTitle(title: string): boolean {
  return /^tot_\d{8}_(?:0[1-9]|[1-9]\d)$/.test(title);
}

// Application writes timestamps explicitly through nowIso(); SQL defaults are fallback only.
const currentSchema = `
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  content_format TEXT NOT NULL DEFAULT 'plain' CHECK (content_format IN ('plain', 'markdown', 'rich')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'to_review', 'final', 'archived')),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  folder_id INTEGER,
  special_role TEXT CHECK (special_role IS NULL OR special_role IN ('todo')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at TEXT,
  deleted_at TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_special_role_unique
ON documents(special_role)
WHERE special_role IS NOT NULL;
`;

interface SchemaMigration {
  version: number;
  name: string;
  migrate: (db: Database.Database) => void;
}

function tableExists(db: Database.Database, tableName: string): boolean {
  return Boolean(
    db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName)
  );
}

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function indexExists(db: Database.Database, indexName: string): boolean {
  return Boolean(db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?`).get(indexName));
}

const legacyDocumentColumns = [
  'id',
  'title',
  'content',
  'content_format',
  'status',
  'favorite',
  'created_at',
  'updated_at',
  'last_opened_at',
  'notes',
];
const currentFolderColumns = ['id', 'name', 'parent_id', 'position', 'created_at', 'updated_at'];

function hasExactColumns(db: Database.Database, tableName: string, expectedColumns: string[]): boolean {
  if (!tableExists(db, tableName)) {
    return false;
  }

  const actualColumns = (db.pragma(`table_info(${tableName})`) as Array<{ name: string }>).map(
    (column) => column.name
  );
  return (
    actualColumns.length === expectedColumns.length &&
    expectedColumns.every((columnName) => actualColumns.includes(columnName))
  );
}

function hasOnlyHistoricalTables(db: Database.Database, expectedTables: string[]): boolean {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all() as Array<{ name: string }>;
  return (
    tables.length === expectedTables.length &&
    expectedTables.every((tableName) => tables.some((table) => table.name === tableName))
  );
}

function inferKnownTextothequeSchemaVersion(db: Database.Database): number | null {
  const documentColumnsV0 = legacyDocumentColumns;
  const documentColumnsV1 = [...legacyDocumentColumns, 'deleted_at'];
  const documentColumnsV2 = [...legacyDocumentColumns, 'deleted_at', 'folder_id'];
  const documentColumnsV3 = [...documentColumnsV2, 'special_role'];

  if (
    hasOnlyHistoricalTables(db, ['documents', 'folders']) &&
    hasExactColumns(db, 'documents', documentColumnsV3) &&
    hasExactColumns(db, 'folders', currentFolderColumns) &&
    indexExists(db, 'idx_documents_special_role_unique')
  ) {
    return 3;
  }

  if (
    hasOnlyHistoricalTables(db, ['documents', 'folders']) &&
    hasExactColumns(db, 'documents', documentColumnsV2) &&
    hasExactColumns(db, 'folders', currentFolderColumns)
  ) {
    return 2;
  }
  if (hasOnlyHistoricalTables(db, ['documents']) && hasExactColumns(db, 'documents', documentColumnsV1)) {
    return 1;
  }
  if (hasOnlyHistoricalTables(db, ['documents']) && hasExactColumns(db, 'documents', documentColumnsV0)) {
    return 0;
  }
  return null;
}

function isKnownSchemaForDeclaredVersion(db: Database.Database, declaredVersion: number): boolean {
  const inferredVersion = inferKnownTextothequeSchemaVersion(db);
  return declaredVersion === 0 ? inferredVersion !== null : inferredVersion === declaredVersion;
}

function getApplicationId(db: Database.Database): number {
  return db.pragma('application_id', { simple: true }) as number;
}

function getUserVersion(db: Database.Database): number {
  return db.pragma('user_version', { simple: true }) as number;
}

function inspectOpenDatabase(db: Database.Database, dbPath: string): LibraryInspection {
  const applicationId = getApplicationId(db);
  const userVersion = getUserVersion(db);
  const base = {
    path: path.resolve(dbPath),
    fileName: path.basename(dbPath),
    readable: true,
    applicationId,
    userVersion,
  };

  if (applicationId !== 0 && applicationId !== TEXTOTHEQUE_APPLICATION_ID) {
    return { ...base, isTextotheque: false, compatibility: 'foreign' };
  }
  if (applicationId === TEXTOTHEQUE_APPLICATION_ID) {
    if (userVersion > CURRENT_SCHEMA_VERSION) {
      return { ...base, isTextotheque: true, compatibility: 'too-new' };
    }
    if (!isKnownSchemaForDeclaredVersion(db, userVersion)) {
      return { ...base, isTextotheque: true, compatibility: 'invalid' };
    }
    return {
      ...base,
      isTextotheque: true,
      compatibility: userVersion === CURRENT_SCHEMA_VERSION ? 'compatible' : 'legacy-textotheque',
    };
  }

  if (userVersion <= CURRENT_SCHEMA_VERSION && isKnownSchemaForDeclaredVersion(db, userVersion)) {
    return { ...base, isTextotheque: true, compatibility: 'legacy-textotheque' };
  }
  return { ...base, isTextotheque: false, compatibility: 'foreign' };
}

export function inspectTextothequeLibrary(dbPath: string): LibraryInspection {
  const resolvedPath = path.resolve(dbPath);
  let inspectionDb: Database.Database | null = null;
  try {
    inspectionDb = new Database(resolvedPath, { readonly: true, fileMustExist: true });
    return inspectOpenDatabase(inspectionDb, resolvedPath);
  } catch {
    return {
      path: resolvedPath,
      fileName: path.basename(resolvedPath),
      readable: false,
      applicationId: null,
      userVersion: null,
      isTextotheque: false,
      compatibility: 'invalid',
    };
  } finally {
    inspectionDb?.close();
  }
}

interface LibraryContentFingerprint {
  documents: number;
  documentPayload: number;
  favorites: number;
  deleted: number;
  folders: number;
  folderPayload: number;
}

function fingerprintLibrary(db: Database.Database): LibraryContentFingerprint {
  const deletedExpression = columnExists(db, 'documents', 'deleted_at')
    ? 'COALESCE(SUM(deleted_at IS NOT NULL), 0)'
    : '0';
  const documentSummary = db
    .prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(length(title) + length(content) + length(notes)), 0) AS payload,
              COALESCE(SUM(favorite), 0) AS favorites,
              ${deletedExpression} AS deleted
       FROM documents`
    )
    .get() as { count: number; payload: number; favorites: number; deleted: number };
  const hasFolders = tableExists(db, 'folders');
  const folderSummary = hasFolders
    ? (db
        .prepare(
          `SELECT COUNT(*) AS count,
                  COALESCE(SUM(length(name)), 0) AS payload
           FROM folders`
        )
        .get() as { count: number; payload: number })
    : { count: 0, payload: 0 };

  return {
    documents: documentSummary.count,
    documentPayload: documentSummary.payload,
    favorites: documentSummary.favorites,
    deleted: documentSummary.deleted,
    folders: folderSummary.count,
    folderPayload: folderSummary.payload,
  };
}

function backupTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}_${String(now.getMilliseconds()).padStart(3, '0')}`;
}

function availablePreMigrationBackupPath(source: LibraryInspection): string {
  const extension = path.extname(source.fileName);
  const baseName = path.basename(source.fileName, extension);
  const operation =
    source.userVersion !== null && source.userVersion < CURRENT_SCHEMA_VERSION
      ? `pre-migration_v${source.userVersion}-to-v${CURRENT_SCHEMA_VERSION}`
      : 'pre-adoption';
  const stem = `${baseName}_${operation}_${backupTimestamp()}`;
  let candidate = path.join(path.dirname(source.path), `${stem}.sqlite`);
  let suffix = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(path.dirname(source.path), `${stem}_${suffix}.sqlite`);
    suffix += 1;
  }
  return candidate;
}

export async function createVerifiedPreMigrationBackup(
  sourceInspection: LibraryInspection
): Promise<PreMigrationBackupResult> {
  if (
    !sourceInspection.readable ||
    !sourceInspection.isTextotheque ||
    sourceInspection.compatibility !== 'legacy-textotheque' ||
    sourceInspection.userVersion === null
  ) {
    throw new Error("La source n'est pas une bibliothèque legacy sauvegardable avant migration.");
  }

  const destinationPath = availablePreMigrationBackupPath(sourceInspection);
  let sourceDb: Database.Database | null = null;
  let destinationDb: Database.Database | null = null;
  try {
    sourceDb = new Database(sourceInspection.path, { readonly: true, fileMustExist: true });
    const sourceFingerprint = fingerprintLibrary(sourceDb);
    await sourceDb.backup(destinationPath);
    sourceDb.close();
    sourceDb = null;

    const backupInspection = inspectTextothequeLibrary(destinationPath);
    if (
      !backupInspection.readable ||
      !backupInspection.isTextotheque ||
      backupInspection.compatibility !== sourceInspection.compatibility ||
      backupInspection.applicationId !== sourceInspection.applicationId ||
      backupInspection.userVersion !== sourceInspection.userVersion
    ) {
      throw new Error("Le backup pré-migration ne correspond pas à l'identité et à la version de la source.");
    }

    destinationDb = new Database(destinationPath, { readonly: true, fileMustExist: true });
    const destinationFingerprint = fingerprintLibrary(destinationDb);
    if (JSON.stringify(destinationFingerprint) !== JSON.stringify(sourceFingerprint)) {
      throw new Error("Le contenu représentatif du backup pré-migration ne correspond pas à la source.");
    }

    return { path: destinationPath, inspection: backupInspection };
  } finally {
    destinationDb?.close();
    sourceDb?.close();
  }
}

const schemaMigrations: SchemaMigration[] = [
  {
    version: 1,
    name: 'add documents.deleted_at',
    migrate: (db) => {
      if (!columnExists(db, 'documents', 'deleted_at')) {
        db.exec(`ALTER TABLE documents ADD COLUMN deleted_at TEXT`);
      }
    },
  },
  {
    version: 2,
    name: 'add folders and documents.folder_id',
    migrate: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          parent_id INTEGER,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
        )
      `);
      if (!columnExists(db, 'documents', 'folder_id')) {
        db.exec(`ALTER TABLE documents ADD COLUMN folder_id INTEGER`);
      }
    },
  },
  {
    version: 3,
    name: 'add documents.special_role and unique role index',
    migrate: (db) => {
      if (!columnExists(db, 'documents', 'special_role')) {
        db.exec(
          `ALTER TABLE documents
           ADD COLUMN special_role TEXT
           CHECK (special_role IS NULL OR special_role IN ('todo'))`
        );
      }
      db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_special_role_unique
         ON documents(special_role)
         WHERE special_role IS NOT NULL`
      );
    },
  },
];

export class TextothequeDatabase {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath: string, reservedNewDatabase = false) {
    this.dbPath = path.resolve(dbPath);
    const databaseAlreadyExisted = fs.existsSync(this.dbPath) && !reservedNewDatabase;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);

    try {
      this.assertAdoptableIdentity(databaseAlreadyExisted);
      this.db.pragma('journal_mode = WAL');
      this.initializeSchema(databaseAlreadyExisted);
      this.createIndexes();
      this.cleanupEmptyDraftDocuments();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  private assertAdoptableIdentity(databaseAlreadyExisted: boolean): void {
    const applicationId = getApplicationId(this.db);
    const declaredVersion = this.getSchemaVersion();

    if (applicationId !== 0 && applicationId !== TEXTOTHEQUE_APPLICATION_ID) {
      throw new Error(`Cette base SQLite n'est pas une bibliothèque Textothèque.`);
    }
    if (declaredVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `La base utilise le schema ${declaredVersion}, plus recent que le schema ${CURRENT_SCHEMA_VERSION} pris en charge.`
      );
    }
    if (
      databaseAlreadyExisted &&
      applicationId === 0 &&
      !isKnownSchemaForDeclaredVersion(this.db, declaredVersion)
    ) {
      throw new Error(`Cette base SQLite non signée ne correspond pas à un schéma historique Textothèque connu.`);
    }
    if (
      databaseAlreadyExisted &&
      applicationId === TEXTOTHEQUE_APPLICATION_ID &&
      !isKnownSchemaForDeclaredVersion(this.db, declaredVersion)
    ) {
      throw new Error(`Cette bibliothèque Textothèque déclare un schéma incohérent.`);
    }
  }

  private initializeSchema(databaseAlreadyExisted: boolean): void {
    const declaredVersion = this.getSchemaVersion();

    if (!databaseAlreadyExisted) {
      const createLatestSchema = this.db.transaction(() => {
        this.db.exec(currentSchema);
        this.setSchemaVersion(CURRENT_SCHEMA_VERSION);
        this.setApplicationId(TEXTOTHEQUE_APPLICATION_ID);
      });
      createLatestSchema();
      this.validateCurrentSchema();
      return;
    }

    if (declaredVersion === 0) {
      this.setSchemaVersion(this.inferUnversionedSchemaVersion());
    }

    this.validateSchemaVersion(this.getSchemaVersion());
    this.runMigrations();
    this.validateCurrentSchema();
    if (getApplicationId(this.db) === 0) {
      this.setApplicationId(TEXTOTHEQUE_APPLICATION_ID);
    }
  }

  private getSchemaVersion(): number {
    return this.db.pragma('user_version', { simple: true }) as number;
  }

  private setSchemaVersion(version: number): void {
    this.db.pragma(`user_version = ${version}`);
  }

  private setApplicationId(applicationId: number): void {
    this.db.pragma(`application_id = ${applicationId}`);
  }

  private inferUnversionedSchemaVersion(): number {
    const hasDeletedAt = columnExists(this.db, 'documents', 'deleted_at');
    const hasFolderId = columnExists(this.db, 'documents', 'folder_id');
    const hasSpecialRole = columnExists(this.db, 'documents', 'special_role');
    const hasFolders = tableExists(this.db, 'folders');

    if (hasDeletedAt && hasFolderId && hasSpecialRole && hasFolders) {
      return 3;
    }
    if (hasDeletedAt && hasFolderId && hasFolders) {
      return 2;
    }
    if (hasDeletedAt) {
      return 1;
    }
    return 0;
  }

  private runMigrations(): void {
    let currentVersion = this.getSchemaVersion();

    for (const migration of schemaMigrations) {
      if (migration.version <= currentVersion) {
        continue;
      }

      const applyMigration = this.db.transaction(() => {
        migration.migrate(this.db);
        this.setSchemaVersion(migration.version);
      });
      applyMigration();
      currentVersion = migration.version;
    }

    if (currentVersion !== CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `La base utilise le schema ${currentVersion}; le schema attendu est ${CURRENT_SCHEMA_VERSION}.`
      );
    }
  }

  private validateSchemaVersion(version: number): void {
    const missingStructures: string[] = [];
    if (version >= 1 && !columnExists(this.db, 'documents', 'deleted_at')) {
      missingStructures.push('documents.deleted_at');
    }
    if (version >= 2 && !columnExists(this.db, 'documents', 'folder_id')) {
      missingStructures.push('documents.folder_id');
    }
    if (version >= 2 && !tableExists(this.db, 'folders')) {
      missingStructures.push('folders');
    }
    if (version >= 3 && !columnExists(this.db, 'documents', 'special_role')) {
      missingStructures.push('documents.special_role');
    }

    if (missingStructures.length > 0) {
      throw new Error(
        `Le schema declare la version ${version}, mais il manque: ${missingStructures.join(', ')}.`
      );
    }
  }

  private validateCurrentSchema(): void {
    const missingStructures: string[] = [];
    if (!columnExists(this.db, 'documents', 'deleted_at')) {
      missingStructures.push('documents.deleted_at');
    }
    if (!columnExists(this.db, 'documents', 'folder_id')) {
      missingStructures.push('documents.folder_id');
    }
    if (!tableExists(this.db, 'folders')) {
      missingStructures.push('folders');
    }
    if (!columnExists(this.db, 'documents', 'special_role')) {
      missingStructures.push('documents.special_role');
    }

    if (missingStructures.length > 0) {
      throw new Error(`Schema SQLite incomplet: ${missingStructures.join(', ')}.`);
    }
  }

  private createIndexes(): void {
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_last_opened_at ON documents(last_opened_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id)`);
    this.db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_special_role_unique
       ON documents(special_role)
       WHERE special_role IS NOT NULL`
    );
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)`);
  }

  private assertFolderExists(folderId: number | null, operation: string): void {
    if (folderId === null) {
      return;
    }

    const folder = this.db.prepare(`SELECT 1 FROM folders WHERE id = ?`).get(folderId);
    if (!folder) {
      throw new Error(`${operation} : le dossier ${folderId} est introuvable.`);
    }
  }

  cleanupEmptyDraftDocuments(): number {
    const now = nowIso();
    const candidates = this.db
      .prepare(
        `SELECT id, title
         FROM documents
         WHERE content_format = 'plain'
           AND status = 'draft'
           AND favorite = 0
           AND special_role IS NULL
           AND deleted_at IS NULL
           AND trim(content) = ''
           AND trim(notes) = ''`
      )
      .all() as Array<{ id: number; title: string }>;
    const idsToCleanup = candidates
      .filter(({ title }) => title.trim() === '' || title === 'Sans titre' || isAutomaticDocumentTitle(title))
      .map(({ id }) => id);

    if (idsToCleanup.length === 0) return 0;

    const trashDraft = this.db.prepare(
      `UPDATE documents
       SET deleted_at = @now,
           updated_at = @now
       WHERE id = @id AND deleted_at IS NULL`
    );
    const cleanupDrafts = this.db.transaction((documentIds: number[]) =>
      documentIds.reduce((changes, id) => changes + trashDraft.run({ id, now }).changes, 0)
    );

    return cleanupDrafts(idsToCleanup);
  }

  listDocuments(): TextDocument[] {
    return this.db
      .prepare(
        `SELECT id, title, content, content_format, status, favorite, folder_id, special_role, created_at, updated_at, last_opened_at, deleted_at, notes
         FROM documents
         WHERE deleted_at IS NULL
         ORDER BY updated_at DESC, id DESC`
      )
      .all() as TextDocument[];
  }

  listDocumentCatalog(options: DocumentCatalogOptions): CatalogDocument[] {
    const sortExpressions: Record<CatalogSortField, string[]> = {
      title: ['d.title COLLATE NOCASE'],
      folder: ['f.name IS NULL', 'f.name COLLATE NOCASE'],
      status: ['d.status COLLATE NOCASE'],
      favorite: ['d.favorite'],
      created_at: ['d.created_at'],
      updated_at: ['d.updated_at'],
    };
    const sortBy = options?.sortBy;
    if (!Object.prototype.hasOwnProperty.call(sortExpressions, sortBy)) {
      throw new Error(`Champ de tri catalogue inconnu: ${String(sortBy)}.`);
    }
    const sqlDirection = options?.direction === 'asc'
      ? 'ASC'
      : options?.direction === 'desc'
        ? 'DESC'
        : null;
    if (!sqlDirection) {
      throw new Error(`Direction de tri catalogue inconnue: ${String(options?.direction)}.`);
    }
    const orderBy = [
      ...sortExpressions[sortBy as CatalogSortField].map((expression) => `${expression} ${sqlDirection}`),
      `d.id ${sqlDirection}`,
    ].join(', ');
    const rows = this.db
      .prepare(
        `SELECT d.id AS id,
                d.title AS title,
                d.folder_id AS folderId,
                f.name AS folderName,
                d.status AS status,
                d.favorite AS favorite,
                d.created_at AS createdAt,
                d.updated_at AS updatedAt,
                d.special_role AS specialRole
         FROM documents d
         LEFT JOIN folders f ON f.id = d.folder_id
         WHERE d.deleted_at IS NULL
         ORDER BY ${orderBy}`
      )
      .all() as Array<Omit<CatalogDocument, 'favorite'> & { favorite: number }>;

    return rows.map((row) => ({ ...row, favorite: row.favorite === 1 }));
  }

  listDeletedDocuments(): TextDocument[] {
    return this.db
      .prepare(
        `SELECT id, title, content, content_format, status, favorite, folder_id, special_role, created_at, updated_at, last_opened_at, deleted_at, notes
         FROM documents
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC, updated_at DESC, id DESC`
      )
      .all() as TextDocument[];
  }

  getDocument(id: number): TextDocument | null {
    const document = this.db
      .prepare(
        `SELECT id, title, content, content_format, status, favorite, folder_id, special_role, created_at, updated_at, last_opened_at, deleted_at, notes
         FROM documents
         WHERE id = ?`
      )
      .get(id) as TextDocument | undefined;

    return document ?? null;
  }

  createDocument(folderId: number | null = null, creationDate = new Date()): TextDocument {
    const create = this.db.transaction(() => {
      this.assertFolderExists(folderId, 'Impossible de creer le document');
      const localDate = localDocumentTitleDate(creationDate);
      const prefix = `tot_${localDate}_`;
      const suffixStart = prefix.length + 1;
      const maximum = this.db
        .prepare(
          `SELECT COALESCE(MAX(CAST(substr(title, @suffix_start, 2) AS INTEGER)), 0) AS maximum_suffix
           FROM documents
           WHERE length(title) = @title_length
             AND substr(title, 1, @prefix_length) = @prefix
             AND substr(title, @suffix_start, 2) GLOB '[0-9][0-9]'
             AND CAST(substr(title, @suffix_start, 2) AS INTEGER) BETWEEN 1 AND @maximum_allowed`
        )
        .get({
          prefix,
          prefix_length: prefix.length,
          suffix_start: suffixStart,
          title_length: prefix.length + 2,
          maximum_allowed: MAX_AUTOMATIC_DOCUMENTS_PER_DAY,
        }) as { maximum_suffix: number };
      if (maximum.maximum_suffix >= MAX_AUTOMATIC_DOCUMENTS_PER_DAY) {
        throw new Error(
          `Impossible de créer un nouveau document : la limite de ${MAX_AUTOMATIC_DOCUMENTS_PER_DAY} documents automatiques pour aujourd'hui est atteinte.`
        );
      }
      const title = `${prefix}${String(maximum.maximum_suffix + 1).padStart(2, '0')}`;
      const now = nowIso(creationDate);
      const result = this.db
        .prepare(
          `INSERT INTO documents (title, content, content_format, status, favorite, folder_id, created_at, updated_at, last_opened_at, notes)
           VALUES (@title, @content, 'plain', 'draft', 0, @folder_id, @now, @now, @now, '')`
        )
        .run({ title, content: '', folder_id: folderId, now });

      const document = this.getDocument(Number(result.lastInsertRowid));
      if (!document) throw new Error('Le document cree est introuvable.');
      return document;
    });

    return create();
  }

  getOrCreateSpecialDocument(role: SpecialDocumentRole): TextDocument {
    if (role !== 'todo') {
      throw new Error(`Role de document special inconnu: ${String(role)}.`);
    }

    const getOrCreate = this.db.transaction(() => {
      const existing = this.db
        .prepare(`SELECT id FROM documents WHERE special_role = ?`)
        .get(role) as { id: number } | undefined;
      if (existing) {
        this.db.prepare(`UPDATE documents SET last_opened_at = @now WHERE id = @id`).run({
          id: existing.id,
          now: nowIso(),
        });
        const document = this.getDocument(existing.id);
        if (!document) throw new Error('Le document special est introuvable.');
        return document;
      }

      const now = nowIso();
      const result = this.db
        .prepare(
          `INSERT INTO documents
             (title, content, content_format, status, favorite, folder_id, special_role, created_at, updated_at, last_opened_at, notes)
           VALUES
             ('TODO', '', 'plain', 'active', 0, NULL, @role, @now, @now, @now, '')`
        )
        .run({ role, now });
      const document = this.getDocument(Number(result.lastInsertRowid));
      if (!document) throw new Error('Le document TODO cree est introuvable.');
      return document;
    });

    return getOrCreate();
  }

  updateDocument(id: number, input: DocumentInput): TextDocument {
    const folderId = input.folder_id ?? null;
    this.assertFolderExists(folderId, 'Impossible de mettre a jour le document');
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE documents
         SET title = @title,
             content = @content,
             notes = @notes,
             status = @status,
             favorite = @favorite,
             folder_id = @folder_id,
             content_format = 'plain',
             updated_at = @now
         WHERE id = @id`
      )
      .run({
        id,
        title: input.title.trim(),
        content: input.content,
        notes: input.notes,
        status: input.status,
        favorite: input.favorite ? 1 : 0,
        folder_id: folderId,
        now,
      });

    const document = this.getDocument(id);
    if (!document) {
      throw new Error('Le document a mettre a jour est introuvable.');
    }
    return document;
  }

  listFolders(): Folder[] {
    return this.db
      .prepare(
        `SELECT id, name, parent_id, position, created_at, updated_at
         FROM folders
         ORDER BY parent_id IS NOT NULL, parent_id, position, name COLLATE NOCASE, id`
      )
      .all() as Folder[];
  }

  createFolder(parentId: number | null = null): Folder {
    this.assertFolderExists(parentId, 'Impossible de creer le sous-dossier');
    const now = nowIso();
    const position = this.db
      .prepare(
        `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
         FROM folders
         WHERE (parent_id IS NULL AND @parent_id IS NULL) OR parent_id = @parent_id`
      )
      .get({ parent_id: parentId }) as { next_position: number };
    const result = this.db
      .prepare(
        `INSERT INTO folders (name, parent_id, position, created_at, updated_at)
         VALUES ('Nouveau dossier', @parent_id, @position, @now, @now)`
      )
      .run({ parent_id: parentId, position: position.next_position, now });

    const folder = this.db
      .prepare(`SELECT id, name, parent_id, position, created_at, updated_at FROM folders WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as Folder | undefined;
    if (!folder) {
      throw new Error('Le dossier cree est introuvable.');
    }
    return folder;
  }

  renameFolder(id: number, name: string): Folder {
    const now = nowIso();
    const normalizedName = name.trim() || 'Nouveau dossier';
    this.db
      .prepare(
        `UPDATE folders
         SET name = @name,
             updated_at = @now
         WHERE id = @id`
      )
      .run({ id, name: normalizedName, now });

    const folder = this.db
      .prepare(`SELECT id, name, parent_id, position, created_at, updated_at FROM folders WHERE id = ?`)
      .get(id) as Folder | undefined;
    if (!folder) {
      throw new Error('Le dossier a renommer est introuvable.');
    }
    return folder;
  }

  markOpened(id: number): TextDocument {
    const now = nowIso();
    this.db.prepare(`UPDATE documents SET last_opened_at = @now WHERE id = @id`).run({ id, now });

    const document = this.getDocument(id);
    if (!document) {
      throw new Error('Le document ouvert est introuvable.');
    }
    return document;
  }

  trashDocument(id: number): TextDocument {
    const current = this.getDocument(id);
    if (!current) {
      throw new Error('Le document a mettre a la corbeille est introuvable.');
    }
    if (current.special_role !== null) {
      throw new Error('Un document permanent ne peut pas etre place dans la corbeille.');
    }

    const now = nowIso();
    this.db
      .prepare(`UPDATE documents SET deleted_at = @now, updated_at = @now WHERE id = @id AND deleted_at IS NULL`)
      .run({ id, now });

    const document = this.getDocument(id);
    if (!document) {
      throw new Error('Le document a mettre a la corbeille est introuvable.');
    }
    return document;
  }

  restoreDocument(id: number): TextDocument {
    const now = nowIso();
    this.db
      .prepare(`UPDATE documents SET deleted_at = NULL, updated_at = @now WHERE id = @id AND deleted_at IS NOT NULL`)
      .run({ id, now });

    const document = this.getDocument(id);
    if (!document) {
      throw new Error('Le document a restaurer est introuvable.');
    }
    return document;
  }

  emptyTrash(): number {
    const result = this.db.prepare(`DELETE FROM documents WHERE deleted_at IS NOT NULL`).run();
    return result.changes;
  }

  getLibraryInfo(): LibraryInfo {
    return {
      path: this.dbPath,
      fileName: path.basename(this.dbPath),
      applicationId: getApplicationId(this.db),
      userVersion: this.getSchemaVersion(),
      isTextotheque: getApplicationId(this.db) === TEXTOTHEQUE_APPLICATION_ID,
    };
  }

  async backupTo(destinationPath: string): Promise<LibraryInspection> {
    const resolvedDestination = path.resolve(destinationPath);
    if (this.isCurrentLibraryPath(resolvedDestination)) {
      throw new Error('La destination de sauvegarde doit être différente de la bibliothèque courante.');
    }

    await this.db.backup(resolvedDestination);
    const inspection = inspectTextothequeLibrary(resolvedDestination);
    if (
      inspection.compatibility !== 'compatible' ||
      inspection.applicationId !== TEXTOTHEQUE_APPLICATION_ID ||
      inspection.userVersion !== CURRENT_SCHEMA_VERSION
    ) {
      throw new Error("La copie créée n'a pas pu être vérifiée comme bibliothèque Textothèque compatible.");
    }
    return inspection;
  }

  isCurrentLibraryPath(candidatePath: string): boolean {
    const comparablePath = (candidatePath: string) => {
      const resolvedPath = path.resolve(candidatePath);
      const canonicalPath = fs.existsSync(resolvedPath) ? fs.realpathSync.native(resolvedPath) : resolvedPath;
      return process.platform === 'win32' ? canonicalPath.toLocaleLowerCase('en-US') : canonicalPath;
    };
    return comparablePath(this.dbPath) === comparablePath(candidatePath);
  }

  close(): void {
    this.db.close();
  }
}

export function createTextothequeDatabase(dbPath: string): TextothequeDatabase {
  return new TextothequeDatabase(dbPath);
}

export function createNewTextothequeDatabase(dbPath: string): TextothequeDatabase {
  const resolvedPath = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const descriptor = fs.openSync(resolvedPath, 'wx');
  fs.closeSync(descriptor);
  try {
    return new TextothequeDatabase(resolvedPath, true);
  } catch (error) {
    try {
      fs.unlinkSync(resolvedPath);
    } catch (cleanupError) {
      console.error('[Database new-library cleanup]', cleanupError);
    }
    throw error;
  }
}
