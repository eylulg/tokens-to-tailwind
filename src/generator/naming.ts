import type { Token, TokenType } from "@/model/tokens";

/** Tailwind 4 theme namespace for each token type. Line heights are handled separately. */
export type Namespace = "color" | "spacing" | "radius" | "font" | "text" | "font-weight" | "leading" | "shadow";

export const NAMESPACE_BY_TYPE: Record<TokenType, Namespace> = {
    color: "color",
    spacing: "spacing",
    dimension: "spacing",
    radius: "radius",
    fontFamily: "font",
    fontSize: "text",
    lineHeight: "leading",
    fontWeight: "font-weight",
    shadow: "shadow",
};

/** Group names that only repeat the namespace and are dropped from the variable name. */
const REDUNDANT: Record<Namespace, string[]> = {
    color: ["color", "colors", "colour", "colours"],
    spacing: ["spacing", "space", "spaces", "size", "sizes", "sizing", "dimension", "dimensions"],
    radius: ["radius", "radii", "border-radius", "rounded", "corner", "corners", "dimension", "dimensions"],
    font: ["font-family", "font-families", "families", "family", "typeface", "fonts", "font", "typography"],
    text: ["font-size", "font-sizes", "text", "typography", "sizes", "size", "font"],
    "font-weight": ["font-weight", "font-weights", "weights", "weight", "font", "typography"],
    leading: ["line-height", "line-heights", "leading", "typography", "font", "fonts"],
    shadow: ["box-shadow", "shadows", "shadow", "elevation"],
};

export function kebab(segment: string): string {
    return segment
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .replace(/\./g, "_")
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/** Path segments with redundant namespace groups and prefixes removed. */
export function cleanSegments(path: string[], namespace: Namespace): string[] {
    const redundant = REDUNDANT[namespace];
    let segments = path.map(kebab).filter(Boolean);

    while (segments.length > 1 && redundant.includes(segments[0] ?? "")) segments = segments.slice(1);

    // "spacing-md" inside a spacing group becomes "md"; longest prefixes are listed first.
    const first = segments[0];
    for (const word of redundant) {
        if (first?.startsWith(`${word}-`) && first.length > word.length + 1) {
            segments = [first.slice(word.length + 1), ...segments.slice(1)];
            break;
        }
    }

    // "text" followed by "text-primary" repeats itself: keep only "text-primary".
    segments = segments.filter((segment, i) => !segments[i + 1]?.startsWith(`${segment}-`));

    if (segments.length > 1 && /^(default|base|DEFAULT)$/.test(segments.at(-1) ?? "")) segments = segments.slice(0, -1);
    return segments.length ? segments : ["default"];
}

export type Naming = "path" | "leaf";

/**
 * Returns a map from token name to variable suffix for one namespace.
 * `path` joins every cleaned segment. `leaf` keeps the shortest trailing part that is still unique
 * (never a bare number: `gray.500` stays `gray-500`).
 */
export function nameTokens(tokens: Token[], namespace: Namespace, naming: Naming): Map<string, string> {
    const distinct = new Map<string, string[]>();
    for (const token of tokens) if (!distinct.has(token.name)) distinct.set(token.name, cleanSegments(token.path, namespace));

    const names = new Map<string, string>();
    if (naming === "path") {
        for (const [name, segments] of distinct) names.set(name, segments.join("-"));
        return names;
    }

    const all = [...distinct.entries()];
    for (const [name, segments] of all) {
        // A bare scale step such as "500" says nothing on its own, so keep its parent ("gray-500").
        let length = segments.length > 1 && /^\d+(_\d+)?$/.test(segments.at(-1) ?? "") ? 2 : 1;
        while (length < segments.length) {
            const suffix = segments.slice(-length).join("-");
            const clash = all.some(([other, otherSegments]) => other !== name && otherSegments.slice(-length).join("-") === suffix);
            if (!clash) break;
            length += 1;
        }
        names.set(name, segments.slice(-length).join("-"));
    }
    return names;
}
