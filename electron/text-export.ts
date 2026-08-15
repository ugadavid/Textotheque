import fs from 'node:fs/promises';

export interface TextExportDraft {
  title: string;
  content: string;
}

export interface TextExportResult {
  canceled: boolean;
  fileName: string | null;
}

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function suggestedTextExportFileName(title: string): string {
  let baseName = title.trim().replace(/\.txt$/i, '').trim();
  baseName = baseName
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*-\s*){2,}/g, ' - ')
    .replace(/^[.\s-]+|[.\s-]+$/g, '');

  if (!baseName) baseName = 'Sans titre';
  if (WINDOWS_RESERVED_NAME.test(baseName)) baseName = `${baseName} - document`;
  return `${baseName}.txt`;
}

export async function writeTextExport(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, { encoding: 'utf8' });
}
