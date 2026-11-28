export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cardioatlas.theme.v1';

/**
 * Определяет начальную тему интерфейса из localStorage или системных настроек.
 */
export function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Игнорируем отказ localStorage и переходим к проверке системной темы.
  }
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Игнорируем ошибку matchMedia в ограниченных средах.
  }
  return 'light';
}

/**
 * Применяет тему к корневому элементу документа, мета-тегу theme-color и сохраняет выбор.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document !== 'undefined') {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = theme;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
    }
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Игнорируем ошибку записи при отключённом хранилище.
    }
  }
}
