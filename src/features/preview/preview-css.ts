import type { Declaration, ThemeOptions } from "@/generator";
import { planTheme } from "@/generator";
import type { Token } from "@/model/tokens";
import libraryTheme from "@eylulg/ui/theme.css?raw";

/**
 * The library's semantic variables (for example `--ui-bg-brand-solid: var(--color-brand-600)`)
 * are resolved where they are declared, on `:root`. Overriding `--color-brand-600` inside the
 * preview would not reach them, so the preview re-declares every `--ui-*` mapping inside its
 * own scope. Then the scoped primitives from the parsed tokens flow through.
 */
function extractSemanticVariables(css: string): { light: string[]; dark: string[] } {
    const darkStart = css.indexOf("color-scheme: dark");
    const lightPart = darkStart === -1 ? css : css.slice(0, darkStart);
    const darkPart = darkStart === -1 ? "" : css.slice(darkStart);
    const declarations = (part: string) => part.match(/--ui-[\w-]+:\s*[^;{}]+;/g) ?? [];
    return { light: declarations(lightPart), dark: declarations(darkPart) };
}

const LIBRARY_VARIABLES = extractSemanticVariables(libraryTheme);
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

/** `--color-bg-primary` in the tokens drives `--ui-bg-primary` in the library. */
function semanticMappings(declarations: Declaration[]): string[] {
    const out: string[] = [];
    for (const { name } of declarations) {
        const semantic = name.replace(/^--color-/, "--ui-");
        if (semantic !== name && LIBRARY_NAMES.has(semantic)) out.push(`${semantic}: var(${name});`);
    }
    return out;
}

/** Lets token sets that do not use the library names still drive the preview. */
function roleAliases(declarations: Declaration[]): string[] {
    const names = new Set(declarations.map((d) => d.name));
    const out: string[] = [];

    const hasScale = (name: string) => SCALE_STEPS.some((step) => names.has(`--color-${name}-${step}`));
    for (const [target, candidates] of SCALE_ALIASES) {
        if (hasScale(target)) continue;
        const source = candidates.find(hasScale);
        if (!source) continue;
        for (const step of SCALE_STEPS) {
            if (names.has(`--color-${source}-${step}`)) out.push(`--color-${target}-${step}: var(--color-${source}-${step});`);
        }
    }

    const firstMatch = (pattern: RegExp) => declarations.find((d) => pattern.test(d.name))?.name;

    // A single brand color without a scale, for example `--color-accent`.
    if (!hasScale("brand") && !out.some((l) => l.startsWith("--color-brand-"))) {
        const brand = firstMatch(/^--color-(.*-)?(brand|primary|accent)(-solid|-default)?$/);
        if (brand) {
            out.push(
                `--color-brand-500: var(${brand});`,
                `--color-brand-600: var(${brand});`,
                `--color-brand-700: color-mix(in oklch, var(${brand}) 85%, black);`,
                `--color-brand-50: color-mix(in oklch, var(${brand}) 10%, white);`,
                `--color-brand-100: color-mix(in oklch, var(${brand}) 18%, white);`,
                `--color-brand-200: color-mix(in oklch, var(${brand}) 30%, white);`,
                `--color-brand-300: color-mix(in oklch, var(${brand}) 50%, white);`,
            );
        }
    }

    const surface = firstMatch(/^--color-(.*-)?(bg|background|surface|canvas)(-primary|-default|-canvas)?$/);
    if (surface && surface !== "--color-bg-primary") out.push(`--ui-bg-primary: var(${surface});`);
    const text = firstMatch(/^--color-(.*-)?(text|fg|foreground|content)(-primary|-default)?$/);
    if (text && text !== "--color-text-primary") out.push(`--ui-text-primary: var(${text});`);

    const body = firstMatch(/^--font-(body|sans|text|base|primary)$/) ?? declarations.find((d) => d.namespace === "font")?.name;
    if (body && body !== "--font-sans") out.push(`--font-sans: var(${body});`);
    const display = firstMatch(/^--font-(display|heading|headline|serif)$/) ?? body;
    if (display && display !== "--font-display") out.push(`--font-display: var(${display});`);

    return out;
}

/**
 * CSS that themes everything inside `scope` with the parsed tokens. The dark rule only
 * applies when the scope itself has `.dark-mode`, so the preview toggle is independent of the page theme.
 */
export function buildPreviewCss(tokens: Token[], scope: string, options: ThemeOptions): string {
    const plan = planTheme(tokens, { ...options, preserveAliases: true });
    const line = (text: string) => `    ${text}`;
    const decl = (d: Declaration) => line(`${d.name}: ${d.value};`);

    const light = [
        ...LIBRARY_VARIABLES.light.map(line),
        ...roleAliases(plan.base).map(line),
        ...semanticMappings(plan.base).map(line),
        ...plan.base.map(decl),
    ];
    const dark = [...LIBRARY_VARIABLES.dark.map(line), ...semanticMappings(plan.dark).map(line), ...plan.dark.map(decl)];

    return [`${scope} {\n${light.join("\n")}\n}`, `${scope}.dark-mode {\n${dark.join("\n")}\n}`].join("\n");
}
