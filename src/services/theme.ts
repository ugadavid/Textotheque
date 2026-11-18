import { logRendererError } from './errors';

type Theme = 'light' | 'dark';
const storageKey = 'textotheque:theme:v1';

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  void window.textotheque?.setTheme(theme).catch((error: unknown) => logRendererError('set-theme', error));
}

export function initializeTheme(): void {
  let initial: Theme = 'light';
  try {
    if (localStorage.getItem(storageKey) === 'dark') initial = 'dark';
  } catch (error) {
    logRendererError('read-theme', error);
  }
  applyTheme(initial);
  window.textotheque?.onThemeChoice((theme) => {
    if (theme !== 'light' && theme !== 'dark') return;
    applyTheme(theme);
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {
      logRendererError('persist-theme', error);
    }
  });
}
