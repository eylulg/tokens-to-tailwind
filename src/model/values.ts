import { cssColor } from './color';
import type { TokenType } from './tokens';

/** Infers a more specific token type from the token path. Used for generic dimensions and numbers. */
export function classifyByPath(path: string[], fallback: TokenType): TokenType {
  const joined = path
    .join('/')
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  if (/radius|radii|rounded|corner/.test(joined)) return 'radius';
  if (/line-?height|leading/.test(joined)) return 'lineHeight';
  if (/font-?weight|(^|\/)weight/.test(joined)) return 'fontWeight';
  if (/font-?size|text-?size|(^|\/)font-?sizes?(\/|$)/.test(joined)) return 'fontSize';
  // `font.size.md` and `typography.size.md`: the group names the font, the next segment the size.
  if (/(^|\/)(fonts?|typography|type|text)\/([^/]+\/)*sizes?(\/|$)/.test(joined)) return 'fontSize';
  if (/font-?famil|typeface/.test(joined)) return 'fontFamily';
  if (/(^|\/)(spacing|space|spaces|gap|padding|margin|inset)(\/|-|$)/.test(joined))
    return 'spacing';
  if (/shadow|elevation/.test(joined)) return 'shadow';
  return fallback;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

const DIMENSION_PATTERN = /^-?\d*\.?\d+(px|rem|em|%|vh|vw|vmin|vmax|ch|ex|pt)?$/;

/** Normalises a dimension: numbers become px, `{ value, unit }` objects become strings. */
export function toDimension(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value === 0 ? '0' : `${formatNumber(value)}px`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (DIMENSION_PATTERN.test(trimmed)) {
      // Unitless strings such as "16" come from Tokens Studio and mean pixels.
      if (/^-?\d*\.?\d+$/.test(trimmed)) return Number(trimmed) === 0 ? '0' : `${trimmed}px`;
      return trimmed;
    }
    if (/^(calc|clamp|min|max)\(/.test(trimmed)) return trimmed;
    return null;
  }
  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>;
    if (typeof v.value === 'number' && typeof v.unit === 'string') {
      return v.value === 0 ? '0' : `${formatNumber(v.value)}${v.unit}`;
    }
  }
  return null;
}

/** Above this a unitless line height cannot be a multiplier: Figma and Tokens Studio mean pixels. */
const MAX_LINE_HEIGHT_MULTIPLIER = 4;

function unitlessLineHeight(value: number): string {
  return value > MAX_LINE_HEIGHT_MULTIPLIER ? `${formatNumber(value)}px` : formatNumber(value);
}

/** Line heights keep small unitless numbers (a multiplier), read large ones as px, and accept percentages and dimensions. */
export function toLineHeight(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return unitlessLineHeight(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^auto$|^normal$/i.test(trimmed)) return 'normal';
    if (/^\d*\.?\d+$/.test(trimmed)) return unitlessLineHeight(Number(trimmed));
    return toDimension(trimmed);
  }
  return toDimension(value);
}

const WEIGHT_NAMES: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

export function toFontWeight(value: unknown): string | null {
  if (typeof value === 'number' && value >= 1 && value <= 1000) return String(Math.round(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return toFontWeight(Number(trimmed));
    const key = trimmed
      .toLowerCase()
      .replace(/[\s_-]/g, '')
      .replace(/italic$/, '');
    const weight = WEIGHT_NAMES[key];
    return weight ? String(weight) : null;
  }
  return null;
}

export const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
]);

function quoteFamily(name: string): string {
  const trimmed = name.trim().replace(/^["']|["']$/g, '');
  if (
    GENERIC_FAMILIES.has(trimmed) ||
    trimmed.startsWith('var(') ||
    trimmed.startsWith('-apple-system')
  )
    return trimmed;
  return /^[a-zA-Z-]+$/.test(trimmed) ? trimmed : `"${trimmed}"`;
}

export function toFontFamily(value: unknown): string | null {
  if (Array.isArray(value)) {
    const names = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    return names.length ? names.map(quoteFamily).join(', ') : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.split(',').map(quoteFamily).join(', ');
  }
  return null;
}

function shadowLayer(layer: unknown): string | null {
  if (typeof layer === 'string') return layer.trim() || null;
  if (typeof layer !== 'object' || layer === null) return null;
  const v = layer as Record<string, unknown>;
  // DTCG uses offsetX/offsetY, Tokens Studio uses x/y.
  const x = toDimension(v.offsetX ?? v.x ?? 0);
  const y = toDimension(v.offsetY ?? v.y ?? 0);
  const blur = toDimension(v.blur ?? 0);
  const spread = toDimension(v.spread ?? 0);
  const color = cssColor(v.color ?? '#000000');
  if (x === null || y === null || blur === null || spread === null || color === null) return null;
  const inset = v.inset === true || v.type === 'innerShadow' ? 'inset ' : '';
  return `${inset}${x} ${y} ${blur} ${spread} ${color}`;
}

export function toShadow(value: unknown): string | null {
  const layers = Array.isArray(value) ? value : [value];
  const parts = layers.map(shadowLayer);
  if (parts.length === 0 || parts.some((p) => p === null)) return null;
  return parts.join(', ');
}
