import type { SourceFormat, Token } from "@/model/tokens";
import { FORMAT_LABELS } from "@/model/tokens";
import type { Namespace, Naming } from "./naming";
import { NAMESPACE_BY_TYPE, nameTokens } from "./naming";

export type ColorFormat = "oklch" | "hex";

export interface ThemeOptions {
    /** `path` keeps the whole token path, `leaf` shortens to the shortest unique trailing part. */
    naming?: Naming;
    /** Tailwind 4 defaults to oklch. */
    colorFormat?: ColorFormat;
    /** Emit `var(--target)` for aliases whose target is also exported. */
    preserveAliases?: boolean;
    /** Shown in the header comment. */
    source?: SourceFormat | null;
}

export interface Declaration {
    name: string;
    value: string;
    namespace: Namespace;
    /** Token name this declaration was generated from. */
    token: string;
}

export interface ThemePlan {
    base: Declaration[];
    dark: Declaration[];
    warnings: string[];
}

const SECTION_ORDER: Namespace[] = ["color", "font", "text", "font-weight", "leading", "spacing", "radius", "shadow"];

const SECTION_TITLES: Record<Namespace, string> = {
    color: "Colors",
    font: "Font families",
    text: "Font sizes",
    "font-weight": "Font weights",
    leading: "Line heights",
    spacing: "Spacing",
    radius: "Radius",
    shadow: "Shadows",
};

function resolveOptions(options: ThemeOptions): Required<Omit<ThemeOptions, "source">> & Pick<ThemeOptions, "source"> {
    return { naming: "path", colorFormat: "oklch", preserveAliases: true, ...options };
}

/** Maps tokens to Tailwind 4 theme declarations, split into base (light) and dark sets. */
export function planTheme(tokens: Token[], options: ThemeOptions = {}): ThemePlan {
    const opts = resolveOptions(options);
    const warnings: string[] = [];

    // Font sizes first, so line heights and weights with a matching name can attach to them.
    const fontSizes = tokens.filter((t) => t.type === "fontSize");
    const fontSizeNames = nameTokens(fontSizes, "text", opts.naming);
    const fontSizeTokenNames = new Set(fontSizes.map((t) => t.name));
    const fontSizeSuffixes = new Set(fontSizeNames.values());

    const byNamespace = new Map<Namespace, Token[]>();
    for (const token of tokens) {
        const namespace = NAMESPACE_BY_TYPE[token.type];
        const list = byNamespace.get(namespace) ?? [];
        list.push(token);
        byNamespace.set(namespace, list);
    }
    const names = new Map<Namespace, Map<string, string>>();
    for (const [namespace, list] of byNamespace) names.set(namespace, nameTokens(list, namespace, opts.naming));

    /** Variable name for a token, or null when the token has no Tailwind 4 equivalent. */
    const varName = (token: Token): string | null => {
        const namespace = NAMESPACE_BY_TYPE[token.type];
        const suffix = names.get(namespace)?.get(token.name) ?? "default";
        if (token.type === "lineHeight" || token.type === "fontWeight") {
            const property = token.type === "lineHeight" ? "line-height" : "font-weight";
            // Same token path as a font size: a part of a typography composite.
            if (fontSizeTokenNames.has(token.name)) return `--text-${fontSizeNames.get(token.name)}--${property}`;
            if (token.type === "lineHeight" && fontSizeSuffixes.has(suffix)) return `--text-${suffix}--line-height`;
        }
        // The family of a typography composite has no Tailwind `--text-*` sub-property.
        if (token.type === "fontFamily" && fontSizeTokenNames.has(token.name)) return null;
        return `--${namespace}-${suffix}`;
    };

    const nameByToken = new Map<string, string>();
    for (const token of tokens) {
        const name = varName(token);
        if (name) nameByToken.set(`${token.type}|${token.name}`, name);
    }
    const varByTokenName = new Map<string, { name: string; namespace: Namespace }>();
    for (const token of tokens) {
        const name = nameByToken.get(`${token.type}|${token.name}`);
        if (name && !varByTokenName.has(token.name)) varByTokenName.set(token.name, { name, namespace: NAMESPACE_BY_TYPE[token.type] });
    }

    const valueOf = (token: Token): string => {
        if (opts.preserveAliases && token.alias) {
            const target = varByTokenName.get(token.alias);
            if (target && target.namespace === NAMESPACE_BY_TYPE[token.type] && !target.name.includes("--", 2))
                return `var(${target.name})`;
        }
        if (token.type === "color" && opts.colorFormat === "oklch" && token.oklch) return token.oklch;
        return token.value;
    };

    const darkNames = new Set(tokens.filter((t) => t.mode === "dark").map((t) => t.name));
    const lightOrPlainNames = new Set(tokens.filter((t) => t.mode !== "dark").map((t) => t.name));

    const build = (subset: Token[]): Declaration[] => {
        const seen = new Map<string, string>();
        const out: Declaration[] = [];
        for (const token of subset) {
            const name = nameByToken.get(`${token.type}|${token.name}`);
            if (!name) continue;
            const owner = seen.get(name);
            if (owner !== undefined) {
                if (owner !== token.name) warnings.push(`${token.name} and ${owner} both map to ${name}; kept ${owner}`);
                continue;
            }
            seen.set(name, token.name);
            out.push({ name, value: valueOf(token), namespace: NAMESPACE_BY_TYPE[token.type], token: token.name });
        }
        return out;
    };

    // Dark-only tokens also go into the base set so Tailwind generates their utilities.
    const base = build(tokens.filter((t) => t.mode !== "dark" || !lightOrPlainNames.has(t.name)));
    const dark = darkNames.size ? build(tokens.filter((t) => t.mode === "dark")) : [];

    return { base: sortDeclarations(base), dark: sortDeclarations(dark), warnings: [...new Set(warnings)] };
}

function sortDeclarations(declarations: Declaration[]): Declaration[] {
    const sectionOf = (d: Declaration): Namespace => (d.name.startsWith("--text-") ? "text" : d.namespace);
    const out: Declaration[] = [];
    for (const section of SECTION_ORDER) {
        const inSection = declarations.filter((d) => sectionOf(d) === section);
        if (section !== "text") {
            out.push(...inSection);
            continue;
        }
        // Keep `--text-x--line-height` right after `--text-x`.
        const parents = inSection.filter((d) => !d.name.includes("--", 2));
        const children = inSection.filter((d) => d.name.includes("--", 2));
        for (const parent of parents) {
            out.push(parent, ...children.filter((c) => c.name.startsWith(`${parent.name}--`)));
        }
        out.push(...children.filter((c) => !parents.some((p) => c.name.startsWith(`${p.name}--`))));
    }
    return out;
}

function renderBlock(declarations: Declaration[], indent: string, withSections: boolean): string {
    const lines: string[] = [];
    let current: Namespace | null = null;
    for (const d of declarations) {
        const section: Namespace = d.name.startsWith("--text-") ? "text" : d.namespace;
        if (withSections && section !== current) {
            if (current !== null) lines.push("");
            lines.push(`${indent}/* ${SECTION_TITLES[section]} */`);
            current = section;
        }
        lines.push(`${indent}${d.name}: ${d.value};`);
    }
    return lines.join("\n");
}

function header(source: SourceFormat | null | undefined): string {
    const from = source ? ` from ${FORMAT_LABELS[source]}` : "";
    return `/* Generated by Tokens to Tailwind${from}. */`;
}

/**
 * Generates a Tailwind CSS 4 `theme.css`: an `@theme` block plus, when the tokens
 * have dark values, a `.dark-mode` override inside `@layer base`.
 */
export function toTailwindTheme(tokens: Token[], options: ThemeOptions = {}): string {
    const plan = planTheme(tokens, options);
    const parts = [
        header(options.source),
        '/* Targets Tailwind 4. Works with @eylulg/ui or any Tailwind 4 project.\n   Import after @import "tailwindcss". Without @eylulg/ui, also add:\n   @custom-variant dark (&:where(.dark-mode, .dark-mode *)); */',
        "",
        "@theme {",
        renderBlock(plan.base, "    ", true),
        "}",
    ];
    if (plan.dark.length) {
        parts.push("", "@layer base {", "    .dark-mode {", renderBlock(plan.dark, "        ", true), "    }", "}");
    }
    return `${parts.join("\n")}\n`;
}

/** Plain CSS custom properties, for projects without Tailwind. Same names as the Tailwind theme. */
export function toCssVariables(tokens: Token[], options: ThemeOptions = {}): string {
    const plan = planTheme(tokens, options);
    const parts = [header(options.source), "", ":root {", renderBlock(plan.base, "    ", true), "}"];
    if (plan.dark.length) parts.push("", ".dark-mode {", renderBlock(plan.dark, "    ", true), "}");
    return `${parts.join("\n")}\n`;
}

/** The normalised token model as JSON. */
export function toJson(tokens: Token[]): string {
    return `${JSON.stringify(tokens, null, 2)}\n`;
}

/** Declarations scoped to a selector, used by the live preview. */
export function toScopedCss(tokens: Token[], scope: string, options: ThemeOptions = {}): string {
    const plan = planTheme(tokens, options);
    const block = (selector: string, declarations: Declaration[]) =>
        `${selector} {\n${declarations.map((d) => `    ${d.name}: ${d.value};`).join("\n")}\n}`;
    const parts = [block(scope, plan.base)];
    if (plan.dark.length) parts.push(block(`.dark-mode ${scope}, ${scope}.dark-mode`, plan.dark));
    return parts.join("\n");
}
