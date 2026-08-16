import path from 'node:path';

export const STABLE_PROFILE_NAME = 'Textotheque';
export const DEV_PROFILE_NAME = 'Textotheque-Dev';
const DEV_RENDERER_HOST = 'localhost';
const DEV_RENDERER_PORT = 5173;
export const DEV_RENDERER_URL = `http://${DEV_RENDERER_HOST}:${DEV_RENDERER_PORT}`;

export interface RuntimeProfile {
  packaged: boolean;
  displayName: string;
  profileName: string;
  userDataPath: string;
  defaultDatabasePath: string;
  defaultLibraryHistoryPath: string;
}

export type RendererTarget =
  | { kind: 'url'; value: typeof DEV_RENDERER_URL }
  | { kind: 'file'; value: string };

export function resolveRuntimeProfile(appDataPath: string, packaged: boolean): RuntimeProfile {
  const profileName = packaged ? STABLE_PROFILE_NAME : DEV_PROFILE_NAME;
  const userDataPath = path.join(appDataPath, profileName);
  return {
    packaged,
    displayName: packaged ? 'Textotheque' : 'Textotheque DEV',
    profileName,
    userDataPath,
    defaultDatabasePath: path.join(userDataPath, 'textotheque.sqlite'),
    defaultLibraryHistoryPath: path.join(userDataPath, 'library-history.json'),
  };
}

export function resolveRendererTarget(packaged: boolean, compiledElectronDirectory: string): RendererTarget {
  return packaged
    ? { kind: 'file', value: path.join(compiledElectronDirectory, '../dist/index.html') }
    : { kind: 'url', value: DEV_RENDERER_URL };
}
