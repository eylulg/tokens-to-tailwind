import type { Declaration, ThemeOptions } from "@/generator";
import { planTheme } from "@/generator";
import type { Token } from "@/model/tokens";
import untitledTheme from "@/styles/theme.css?raw";

/**
 * Untitled UI semantic variables (for example `--color-bg-brand-solid: var(--color-brand-600)`)
 * are resolved where they are declared, on `:root`. Overriding `--color-brand-600` inside the
 * preview would not reach them, so the preview re-declares every variable-to-variable mapping
 * inside its own scope. Then the scoped primitives from the parsed tokens flow through.
 */
function extractReferences(css: string): { light: string[]; dark: string[] } {
    const darkStart = css.indexOf(".dark-mode {");
    const lightPart = darkStart === -1 ? css : css.slice(0, darkStart);
    const darkPart = darkStart === -1 ? "" : css.slice(darkStart);
    const declarations = (part: string) => part.match(/--[\w-]+:\s*[^;{}]+;/g) ?? [];
    const nameOf = (declaration: string) => declaration.slice(0, declaration.indexOf(":"));

    const dark = declarations(darkPart);
    const darkNames = new Set(dark.map(nameOf));
    // Light: every variable-to-variable mapping, plus every variable dark mode changes, so the
    // preview can be light even when the page around it is dark.
    const light = declarations(lightPart).filter((d) => d.includes("var(--") || darkNames.has(nameOf(d)));
    return { light, dark };
}

const UNTITLED_REFERENCES = extractReferences(untitledTheme);

const SCALE_STEPS = ["25", "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

/** Lets token sets that do not use Untitled UI names still drive the preview. */
function roleAliases(declarations: Declaration[]): string[] {
    const names = new Set(declarations.map((d) => d.name));
    const out: string[] = [];

    const scale = (candidates: string[], target: string) => {
        if (SCALE_STEPS.some((step) => names.has(`--color-${target}-${step}`))) return;
        for (const candidate of candidates) {
            const steps = SCALE_STEPS.filter((step) => names.has(`--color-${candidate}-${step}`));
            if (steps.length === 0) continue;
            for (const step of steps) out.push(`--color-${target}-${step}: var(--color-${candidate}-${step});`);
            return;
        }
    };
    scale(["primary", "accent", "violet", "indigo", "blue", "teal"], "brand");
    // Untitled UI v8 names its gray scale "neutral".
    scale(["gray", "grey", "slate", "zinc", "stone"], "neutral");

    const firstMatch = (pattern: RegExp) => declarations.find((d) => pattern.test(d.name))?.name;

    // A single brand color without a scale, for example `--color-accent`.
    if (!SCALE_STEPS.some((step) => names.has(`--color-brand-${step}`)) && !out.some((l) => l.startsWith("--color-brand-"))) {
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
    if (surface && surface !== "--color-bg-primary") out.push(`--color-bg-primary: var(${surface});`);
    const text = firstMatch(/^--color-(.*-)?(text|fg|foreground|content)(-primary|-default)?$/);
    if (text && text !== "--color-text-primary") out.push(`--color-text-primary: var(${text});`);

    const body = firstMatch(/^--font-(body|sans|text|base|primary)$/) ?? declarations.find((d) => d.namespace === "font")?.name;
    if (body && body !== "--font-body") out.push(`--font-body: var(${body});`);
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

    const light = [...UNTITLED_REFERENCES.light.map(line), ...roleAliases(plan.base).map(line), ...plan.base.map(decl)];
    const dark = [...UNTITLED_REFERENCES.dark.map(line), ...plan.dark.map(decl)];

    return [`${scope} {\n${light.join("\n")}\n}`, `${scope}.dark-mode {\n${dark.join("\n")}\n}`].join("\n");
}
