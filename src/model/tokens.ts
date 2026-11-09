export const TOKEN_TYPES = [
    "color",
    "dimension",
    "fontFamily",
    "fontSize",
    "lineHeight",
    "fontWeight",
    "shadow",
    "radius",
    "spacing",
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

export type Mode = "light" | "dark";

/** The single internal model every parser normalises into. */
export interface Token {
    /** Dotted path, for example `color.brand.500`. */
    name: string;
    /** Path segments as they appear in the source file. */
    path: string[];
    type: TokenType;
    /** CSS-ready value. Colors are lowercase hex (`#rrggbb` or `#rrggbbaa`). */
    value: string;
    /** Colors only: the same color as an `oklch()` string. */
    oklch?: string;
    /** Set when the token belongs to a light or dark mode. Absent for mode-independent tokens. */
    mode?: Mode;
    /** Dotted path of the token this one referenced, when it was an alias. */
    alias?: string;
}

export type SourceFormat = "w3c" | "figma" | "tokens-studio";

export const FORMAT_LABELS: Record<SourceFormat, string> = {
    w3c: "W3C Design Tokens",
    figma: "Figma Variables",
    "tokens-studio": "Tokens Studio",
};

export type IssueCode = "INVALID_JSON" | "UNKNOWN_FORMAT" | "UNRESOLVED_ALIAS" | "ALIAS_CYCLE" | "INVALID_VALUE" | "UNSUPPORTED";

export interface ParseIssue {
    code: IssueCode;
    message: string;
    /** Dotted token path the issue belongs to, when there is one. */
    path?: string;
}

export interface ParseResult {
    format: SourceFormat | null;
    tokens: Token[];
    errors: ParseIssue[];
    warnings: ParseIssue[];
}

/** Number of distinct tokens. A token with light and dark values counts once. */
export function countTokens(tokens: Token[]): number {
    return new Set(tokens.map((t) => `${t.type}|${t.name}`)).size;
}
