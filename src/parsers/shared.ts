import { normaliseColor } from "@/model/color";
import type { Mode, ParseIssue, Token, TokenType } from "@/model/tokens";
import { classifyByPath, toDimension, toFontFamily, toFontWeight, toLineHeight, toShadow } from "@/model/values";

/**
 * Types a format parser may hand to the shared resolver. Besides the model types,
 * `number` is classified by path and `typography` is expanded into its parts.
 */
export type RawType = TokenType | "number" | "typography";

export interface RawEntry {
    path: string[];
    /** Undefined when the type should be taken from the alias target (allowed in DTCG). */
    type?: RawType | string;
    value: unknown;
    mode?: Mode;
}

export interface Issues {
    errors: ParseIssue[];
    warnings: ParseIssue[];
}

export function createIssues(): Issues {
    return { errors: [], warnings: [] };
}

const FULL_REF = /^\{([^{}]+)\}$/;
const EMBEDDED_REF = /\{([^{}]+)\}/g;

class AliasError extends Error {
    readonly code: "UNRESOLVED_ALIAS" | "ALIAS_CYCLE";
    constructor(code: "UNRESOLVED_ALIAS" | "ALIAS_CYCLE", message: string) {
        super(message);
        this.code = code;
    }
}

interface Resolved {
    value: unknown;
    type?: string;
    alias?: string;
}

/**
 * Resolves `{path.to.token}` references across all entries, detecting cycles,
 * then normalises every entry into the internal token model.
 */
export function buildTokens(entries: RawEntry[], issues: Issues): Token[] {
    const index = new Map<string, RawEntry[]>();
    for (const entry of entries) {
        const name = entry.path.join(".");
        const list = index.get(name);
        if (list) list.push(entry);
        else index.set(name, [entry]);
    }

    const lookup = (name: string, mode: Mode | undefined): RawEntry | undefined => {
        const candidates = index.get(name);
        if (!candidates) return undefined;
        return candidates.find((c) => c.mode === mode) ?? candidates.find((c) => c.mode === undefined) ?? candidates[0];
    };

    const resolveValue = (value: unknown, mode: Mode | undefined, stack: string[]): Resolved => {
        if (typeof value === "string") {
            const full = FULL_REF.exec(value.trim());
            if (full) {
                const name = full[1].trim();
                if (stack.includes(name)) {
                    const cycle = [...stack.slice(stack.indexOf(name)), name].join(" -> ");
                    throw new AliasError("ALIAS_CYCLE", `Alias cycle detected: ${cycle}`);
                }
                const target = lookup(name, mode);
                if (!target) throw new AliasError("UNRESOLVED_ALIAS", `Alias {${name}} does not point to an existing token`);
                const inner = resolveValue(target.value, target.mode ?? mode, [...stack, name]);
                return { value: inner.value, type: target.type ?? inner.type, alias: name };
            }
            if (EMBEDDED_REF.test(value)) {
                EMBEDDED_REF.lastIndex = 0;
                const replaced = value.replace(EMBEDDED_REF, (_match, ref: string) => {
                    const inner = resolveValue(`{${ref}}`, mode, stack);
                    if (typeof inner.value !== "string" && typeof inner.value !== "number") {
                        throw new AliasError("UNRESOLVED_ALIAS", `Alias {${ref}} cannot be used inside a string value`);
                    }
                    return String(inner.value);
                });
                return { value: replaced };
            }
            return { value };
        }
        if (Array.isArray(value)) {
            return { value: value.map((item) => resolveValue(item, mode, stack).value) };
        }
        if (typeof value === "object" && value !== null) {
            const out: Record<string, unknown> = {};
            for (const [key, inner] of Object.entries(value)) out[key] = resolveValue(inner, mode, stack).value;
            return { value: out };
        }
        return { value };
    };

    const tokens: Token[] = [];
    for (const entry of entries) {
        const name = entry.path.join(".");
        let resolved: Resolved;
        try {
            resolved = resolveValue(entry.value, entry.mode, [name]);
        } catch (error) {
            if (error instanceof AliasError) {
                issues.errors.push({ code: error.code, message: `${name}: ${error.message}`, path: name });
                continue;
            }
            throw error;
        }
        const type = entry.type ?? resolved.type;
        if (!type) {
            issues.warnings.push({ code: "UNSUPPORTED", message: `${name}: no type could be determined, skipped`, path: name });
            continue;
        }
        tokens.push(...normaliseEntry(entry, type, resolved, issues));
    }
    return tokens;
}

function normaliseEntry(entry: RawEntry, rawType: string, resolved: Resolved, issues: Issues): Token[] {
    const name = entry.path.join(".");
    const base = {
        name,
        path: entry.path,
        ...(entry.mode ? { mode: entry.mode } : {}),
        ...(resolved.alias ? { alias: resolved.alias } : {}),
    };
    const invalid = (type: string): Token[] => {
        issues.errors.push({
            code: "INVALID_VALUE",
            message: `${name}: ${JSON.stringify(resolved.value)} is not a valid ${type} value`,
            path: name,
        });
        return [];
    };
    const simple = (type: TokenType, value: string | null): Token[] => (value === null ? invalid(type) : [{ ...base, type, value }]);

    switch (rawType) {
        case "color": {
            const color = normaliseColor(resolved.value);
            return color ? [{ ...base, type: "color", value: color.hex, oklch: color.oklch }] : invalid("color");
        }
        case "spacing":
        case "radius":
        case "fontSize":
            return simple(rawType, toDimension(resolved.value));
        case "dimension":
        case "number": {
            const type = classifyByPath(entry.path, "dimension");
            if (type === "lineHeight") return simple(type, toLineHeight(resolved.value));
            if (type === "fontWeight") return simple(type, toFontWeight(resolved.value));
            if (type === "fontFamily" || type === "shadow" || type === "color") return invalid(type);
            if (rawType === "number" && type === "dimension") {
                issues.warnings.push({
                    code: "UNSUPPORTED",
                    message: `${name}: plain number with no recognisable role, skipped`,
                    path: name,
                });
                return [];
            }
            return simple(type, toDimension(resolved.value));
        }
        case "lineHeight":
            return simple("lineHeight", toLineHeight(resolved.value));
        case "fontWeight":
            return simple("fontWeight", toFontWeight(resolved.value));
        case "fontFamily":
            return simple("fontFamily", toFontFamily(resolved.value));
        case "shadow":
            return simple("shadow", toShadow(resolved.value));
        case "typography": {
            if (typeof resolved.value !== "object" || resolved.value === null) return invalid("typography");
            const v = resolved.value as Record<string, unknown>;
            const parts: Token[] = [];
            const push = (type: TokenType, value: string | null) => {
                if (value !== null) parts.push({ ...base, type, value });
            };
            if (v.fontFamily !== undefined) push("fontFamily", toFontFamily(v.fontFamily));
            if (v.fontSize !== undefined) push("fontSize", toDimension(v.fontSize));
            if (v.lineHeight !== undefined) push("lineHeight", toLineHeight(v.lineHeight));
            if (v.fontWeight !== undefined) push("fontWeight", toFontWeight(v.fontWeight));
            return parts.length ? parts : invalid("typography");
        }
        default:
            issues.warnings.push({ code: "UNSUPPORTED", message: `${name}: type "${rawType}" is not supported, skipped`, path: name });
            return [];
    }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Maps a set, collection or mode name to light or dark, if it clearly is one. */
export function modeFromName(name: string): Mode | undefined {
    if (/dark|night/i.test(name)) return "dark";
    if (/light|day/i.test(name)) return "light";
    return undefined;
}
