import type { AppState } from './use-app-store';

const KEY = 'tokens-to-tailwind:session';

const PERSISTED = [
  'source',
  'sourceName',
  'naming',
  'colorFormat',
  'preserveAliases',
  'mapRoles',
  'exportFormat',
] as const;

type Persisted = Pick<AppState, (typeof PERSISTED)[number]>;

/** What a reload should bring back. Storage can be blocked or full, so every access is guarded. */
export function loadSession(): Partial<Persisted> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return {};
    const raw = parsed as Record<string, unknown>;
    const out: Partial<Persisted> = {};
    if (typeof raw.source === 'string') out.source = raw.source;
    if (typeof raw.sourceName === 'string' || raw.sourceName === null)
      out.sourceName = raw.sourceName;
    if (raw.naming === 'path' || raw.naming === 'leaf') out.naming = raw.naming;
    if (raw.colorFormat === 'oklch' || raw.colorFormat === 'hex') out.colorFormat = raw.colorFormat;
    if (typeof raw.preserveAliases === 'boolean') out.preserveAliases = raw.preserveAliases;
    if (typeof raw.mapRoles === 'boolean') out.mapRoles = raw.mapRoles;
    if (
      raw.exportFormat === 'tailwind' ||
      raw.exportFormat === 'css' ||
      raw.exportFormat === 'json'
    )
      out.exportFormat = raw.exportFormat;
    return out;
  } catch {
    return {};
  }
}

export function saveSession(state: AppState): void {
  try {
    const snapshot = Object.fromEntries(PERSISTED.map((key) => [key, state[key]]));
    sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode or a full quota: the work simply is not kept across a reload.
  }
}
