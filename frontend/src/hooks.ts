import { RefObject, useCallback, useEffect, useState } from 'react';
import { TabId, isTabId } from './navigation';

/** Close a popover when the user clicks outside it or presses Escape. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, onClose]);
}

export interface Route {
  tab: TabId;
  patientId: string | null;
}

function parseHash(fallback: TabId): Route {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  return { tab: isTabId(path) ? path : fallback, patientId: params.get('patient') };
}

function buildHash(route: Route): string {
  return `#/${route.tab}${route.patientId ? `?patient=${encodeURIComponent(route.patientId)}` : ''}`;
}

/** Hash-based routing so browser back/forward and shared links restore the section and patient. */
export function useHashRoute(fallback: TabId) {
  const [route, setRoute] = useState<Route>(() => parseHash(fallback));

  useEffect(() => {
    const onHash = () => setRoute(parseHash(fallback));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [fallback]);

  const navigate = useCallback((next: Partial<Route>, replace = false) => {
    const merged = { ...parseHash(fallback), ...next };
    const hash = buildHash(merged);
    if (hash !== window.location.hash) {
      if (replace) window.history.replaceState(null, '', hash);
      else window.history.pushState(null, '', hash);
    }
    setRoute(merged);
  }, [fallback]);

  return [route, navigate] as const;
}

/** useState backed by localStorage for small UI preferences. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue] as const;
}

export type ThemePreference = 'light' | 'dark' | 'system';

/** Persisted theme choice; applies data-theme on <html> (index.html does the same before first paint). */
export function useTheme() {
  const [pref, setPref] = usePersistentState<ThemePreference>('marrowq.theme', 'light');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = pref === 'dark' || (pref === 'system' && media.matches) ? 'dark' : 'light';
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121211' : '#f6f5f2');
    };
    apply();
    if (pref !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [pref]);
  return [pref, setPref] as const;
}
