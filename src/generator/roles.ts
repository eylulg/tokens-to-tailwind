import libraryTheme from "@eylulg/ui/theme.css?raw";
import { GENERIC_FAMILIES } from "@/model/values";
import type { Declaration } from "./tailwind";

export interface RoleDeclaration {
    name: string;
    value: string;
}

export interface RoleMappings {
    /** Scale and font aliases (`--color-brand-600`, `--font-sans`). They are valid in an `@theme` block. */
    theme: RoleDeclaration[];
    /** `--ui-*` variables the library resolves on `:root`. They only exist in plain CSS. */
    ui: RoleDeclaration[];
    /** One readable line per alias group, for the preview caption. */
    notes: string[];
}

/**
 * The library's semantic variables (for example `--ui-bg-brand-solid: var(--color-brand-600)`)
 * are resolved where they are declared, on `:root`. Overriding `--color-brand-600` inside a
 * scope would not reach them, so a scope re-declares every `--ui-*` mapping.
 */
function extractSemanticVariables(css: string): { light: string[]; dark: string[] } {
    const darkStart = css.indexOf("color-scheme: dark");
    const lightPart = darkStart === -1 ? css : css.slice(0, darkStart);
    const darkPart = darkStart === -1 ? "" : css.slice(darkStart);
    const declarations = (part: string) => part.match(/--ui-[\w-]+:\s*[^;{}]+;/g) ?? [];
    return { light: declarations(lightPart), dark: declarations(darkPart) };
}

export const LIBRARY_VARIABLES = extractSemanticVariables(libraryTheme);
const LIBRARY_NAMES = new Set(LIBRARY_VARIABLES.light.map((d) => d.slice(0, d.indexOf(":"))));

const SCALE_STEPS = ["25", "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

/** Library scales and the common names a token set may use for them. */
const SCALE_ALIASES: Array<[target: string, candidates: string[]]> = [
    ["brand", ["primary", "accent", "violet", "indigo", "blue", "teal"]],
    ["gray", ["neutral", "grey", "slate", "zinc", "stone"]],
    ["success", ["green", "emerald"]],
    ["warning", ["amber", "yellow", "orange"]],
    ["error", ["red", "rose"]],
];

/** The library stack, after a mapped family, so a font that is not installed still renders sans. */
const SANS_FALLBACK =
    "var(--font-inter, 'Inter'), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF_FALLBACK = "ui-serif, Georgia, 'Times New Roman', serif";
const MONO_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function endsWithGenericFamily(value: string): boolean {
    const last = value
        .split(",")
        .at(-1)
        ?.trim()
        .replace(/^["']|["']$/g, "");
    return last !== undefined && GENERIC_FAMILIES.has(last);
}

function withFallback(declarations: Declaration[], name: string): string {
    const value = declarations.find((d) => d.name === name)?.value ?? "";
    if (endsWithGenericFamily(value)) return `var(${name})`;
    const fallback = /mono/i.test(name) ? MONO_FALLBACK : /serif/i.test(name) && !/sans/i.test(name) ? SERIF_FALLBACK : SANS_FALLBACK;
    return `var(${name}), ${fallback}`;
}

/** `--color-bg-primary` in the tokens drives `--ui-bg-primary` in the library. */
function semanticMappings(declarations: Declaration[]): RoleDeclaration[] {
    const out: RoleDeclaration[] = [];
    for (const { name } of declarations) {
        const semantic = name.replace(/^--color-/, "--ui-");
        if (semantic !== name && LIBRARY_NAMES.has(semantic)) out.push({ name: semantic, value: `var(${name})` });
    }
    return out;
}

/** Maps token sets that do not use the library names onto the library roles. */
export function roleMappings(declarations: Declaration[]): RoleMappings {
    const names = new Set(declarations.map((d) => d.name));
    const theme: RoleDeclaration[] = [];
    const ui = semanticMappings(declarations);
    const notes: string[] = [];

    const hasScale = (name: string) => SCALE_STEPS.some((step) => names.has(`--color-${name}-${step}`));
    for (const [target, candidates] of SCALE_ALIASES) {
        if (hasScale(target)) continue;
        const source = candidates.find(hasScale);
        if (!source) continue;
        notes.push(`${source} as ${target}`);
        for (const step of SCALE_STEPS) {
            if (names.has(`--color-${source}-${step}`)) {
                theme.push({ name: `--color-${target}-${step}`, value: `var(--color-${source}-${step})` });
            }
        }
    }

    const firstMatch = (pattern: RegExp) => declarations.find((d) => pattern.test(d.name))?.name;

    // A single brand color without a scale, for example `--color-accent`.
    if (!hasScale("brand") && !theme.some((d) => d.name.startsWith("--color-brand-"))) {
        const brand = declarations.find(
            (d) =>
                /^--color-(.*-)?(brand|primary|accent)(-solid|-default)?$/.test(d.name) &&
                !/-(bg|background|surface|text|fg|border)-/.test(d.name),
        )?.name;
        if (brand) {
            notes.push(`${brand.slice(2)} as brand`);
            theme.push(
                { name: "--color-brand-500", value: `var(${brand})` },
                { name: "--color-brand-600", value: `var(${brand})` },
                { name: "--color-brand-700", value: `color-mix(in oklch, var(${brand}) 85%, black)` },
                { name: "--color-brand-50", value: `color-mix(in oklch, var(${brand}) 10%, white)` },
                { name: "--color-brand-100", value: `color-mix(in oklch, var(${brand}) 18%, white)` },
                { name: "--color-brand-200", value: `color-mix(in oklch, var(${brand}) 30%, white)` },
                { name: "--color-brand-300", value: `color-mix(in oklch, var(${brand}) 50%, white)` },
            );
        }
    }

    const surface = firstMatch(/^--color-(.*-)?(bg|background|surface|canvas)(-primary|-default|-canvas)?$/);
    if (surface && surface !== "--color-bg-primary") {
        notes.push(`${surface.slice(2)} as the page background`);
        ui.push({ name: "--ui-bg-primary", value: `var(${surface})` });
    }
    const text = firstMatch(/^--color-(.*-)?(text|fg|foreground|content)(-primary|-default)?$/);
    if (text && text !== "--color-text-primary") {
        notes.push(`${text.slice(2)} as the text color`);
        ui.push({ name: "--ui-text-primary", value: `var(${text})` });
    }

    const body = firstMatch(/^--font-(body|sans|text|base|primary)$/) ?? declarations.find((d) => d.namespace === "font")?.name;
    if (body && body !== "--font-sans") {
        notes.push(`${body.slice(2)} as the body font`);
        theme.push({ name: "--font-sans", value: withFallback(declarations, body) });
    }
    const display = firstMatch(/^--font-(display|heading|headline|serif)$/) ?? body;
    if (display && display !== "--font-display") theme.push({ name: "--font-display", value: withFallback(declarations, display) });

    return { theme, ui, notes };
}
