import {
  converter,
  formatHex,
  formatHex8,
  modeHsl,
  modeHwb,
  modeLab,
  modeLch,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeP3,
  modeRgb,
  modeXyz50,
  modeXyz65,
  parse,
  useMode as registerMode,
} from 'culori/fn';

// Register only the color spaces CSS and DTCG files use, which keeps the bundle small.
for (const mode of [
  modeRgb,
  modeLrgb,
  modeHsl,
  modeHwb,
  modeLab,
  modeLch,
  modeOklab,
  modeOklch,
  modeP3,
  modeXyz50,
  modeXyz65,
])
  registerMode(mode);

const toOklch = converter('oklch');
const toRgb = converter('rgb');

export interface NormalisedColor {
  hex: string;
  oklch: string;
  alpha: number;
}

function round(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  // Trim trailing zeros so snapshots stay readable: 0.1500 -> 0.15, 2.00 -> 2.
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

interface RgbLike {
  r: number;
  g: number;
  b: number;
  a?: number;
}

function isRgbObject(value: unknown): value is RgbLike {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.r === 'number' && typeof v.g === 'number' && typeof v.b === 'number';
}

interface DtcgColor {
  colorSpace: string;
  components: (number | 'none')[];
  alpha?: number;
  hex?: string;
}

function isDtcgColor(value: unknown): value is DtcgColor {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.colorSpace === 'string' && Array.isArray(v.components);
}

const DTCG_SPACES: Record<string, string> = {
  srgb: 'srgb',
  'srgb-linear': 'srgb-linear',
  'display-p3': 'display-p3',
  hsl: 'hsl',
  hwb: 'hwb',
  lab: 'lab',
  lch: 'lch',
  oklab: 'oklab',
  oklch: 'oklch',
};

/** Turns a DTCG 2025 color object into a CSS color string culori can read. */
function dtcgToCss(value: DtcgColor): string | null {
  if (value.hex && (!value.alpha || value.alpha === 1)) return value.hex;
  const space = DTCG_SPACES[value.colorSpace];
  if (!space) return value.hex ?? null;
  const parts = value.components.map((c) => (c === 'none' ? 'none' : String(c)));
  const alpha = value.alpha ?? 1;
  if (space === 'hsl') return `hsl(${parts[0]} ${parts[1]}% ${parts[2]}% / ${alpha})`;
  if (space === 'hwb') return `hwb(${parts[0]} ${parts[1]}% ${parts[2]}% / ${alpha})`;
  if (space === 'lab' || space === 'lch' || space === 'oklab' || space === 'oklch') {
    return `${space}(${parts.join(' ')} / ${alpha})`;
  }
  return `color(${space} ${parts.join(' ')} / ${alpha})`;
}

/**
 * Normalises any supported color input into hex plus oklch.
 * Accepts CSS color strings, Figma `{ r, g, b, a }` objects (0 to 1 channels)
 * and DTCG 2025 `{ colorSpace, components, alpha }` objects.
 */
export function normaliseColor(input: unknown): NormalisedColor | null {
  let css: string | null = null;
  if (typeof input === 'string') {
    css = input.trim();
  } else if (isRgbObject(input)) {
    const a = input.a ?? 1;
    css = `color(srgb ${input.r} ${input.g} ${input.b} / ${a})`;
  } else if (isDtcgColor(input)) {
    css = dtcgToCss(input);
  }
  if (!css) return null;

  const parsed = parse(css);
  if (!parsed) return null;

  const rgb = toRgb(parsed);
  const alpha = rgb.alpha ?? 1;
  const hex = alpha < 1 ? formatHex8(rgb) : formatHex(rgb);
  const ok = toOklch(parsed);
  const hue = ok.h === undefined || Number.isNaN(ok.h) ? 0 : ok.h;
  const alphaPart = alpha < 1 ? ` / ${round(alpha, 3)}` : '';
  const oklch = `oklch(${round(ok.l * 100, 2)}% ${round(ok.c, 4)} ${round(hue, 2)}${alphaPart})`;

  return { hex: hex.toLowerCase(), oklch, alpha };
}

/** A compact CSS color for composite values such as shadows. */
export function cssColor(input: unknown): string | null {
  const color = normaliseColor(input);
  if (!color) return null;
  return color.hex;
}
