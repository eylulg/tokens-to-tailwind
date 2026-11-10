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

import { evaluateMath, isMathExpression } from "./math";

const FULL_REF = /^\{([^{}]+)\}$/;
const EMBEDDED_REF = /\{([^{}]+)\}/g;

class AliasError extends Error {
    readonly code: "UNRESOLVED_ALIAS" | "ALIAS_CYCLE";
    constructor(code: "UNRESOLVED_ALIAS" | "ALIAS_CYCLE", message: string) {
        super(message);
        this.code = code;
    }
}

/** A value Tokens Studio would compute but this parser cannot. Reported once, at the token that holds it. */
class UnevaluableError extends Error {
    readonly root: string;
    readonly expression: string;
    constructor(root: string, expression: string) {
        super(expression);
        this.root = root;
        this.expression = expression;
    }
}

export interface BuildOptions {
    /** Evaluate Tokens Studio math such as `{spacing.base} * 2`. */
    math?: boolean;
}

const FUNCTION_CALL = /^([a-z][a-z0-9]*)\(/i;
const CSS_FUNCTIONS = new Set(["calc", "clamp", "min", "max", "var", "env", "color-mix", "rgb", "rgba", "hsl", "hsla", "hwb", "oklch"]);

const HEX_WITH_ALPHA = /^rgba?\(\s*(#[0-9a-f]{3,6})\s*,\s*(\d*\.?\d+)(%?)\s*\)$/i;

/** `rgba(#000000, 0.5)`, what `rgba({color.black}, 0.5)` becomes once the reference is replaced. */
function applyAlpha(text: string): string | null {
    const match = HEX_WITH_ALPHA.exec(text.trim());
    if (!match) return null;
    const hex = (match[1] ?? "").slice(1);
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    const alpha = Math.min(1, Number(match[2]) / (match[3] ? 100 : 1));
    return `#${full}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`;
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
export function buildTokens(entries: RawEntry[], issues: Issues, options: BuildOptions = {}): Token[] {
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

    const unevaluable = (stack: string[], expression: string): UnevaluableError => new UnevaluableError(stack.at(-1) ?? "", expression);

    const resolveValue = (value: unknown, mode: Mode | undefined, stack: string[]): Resolved => {
        if (typeof value === "string") {
            const full = FULL_REF.exec(value.trim());
            if (full) {
                const name = (full[1] ?? "").trim();
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
                return { value: options.math ? compute(replaced, stack, value) : replaced };
            }
            return { value: options.math && isMathExpression(value) ? compute(value, stack, value) : value };
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

    const compute = (text: string, stack: string[], original: string): string => {
        const alpha = applyAlpha(text);
        if (alpha) return alpha;
        if (isMathExpression(text)) {
            const result = evaluateMath(text);
            if (result === null) throw unevaluable(stack, original);
            return result;
        }
        const fn = FUNCTION_CALL.exec(original.trim())?.[1]?.toLowerCase();
        if (fn && !CSS_FUNCTIONS.has(fn)) throw unevaluable(stack, original);
        return text;
    };

    const tokens: Token[] = [];
    const reportedCycles = new Set<string>();
    const reportedExpressions = new Set<string>();
    for (const entry of entries) {
        const name = entry.path.join(".");
        let resolved: Resolved;
        try {
            resolved = resolveValue(entry.value, entry.mode, [name]);
        } catch (error) {
            if (error instanceof UnevaluableError) {
                if (!reportedExpressions.has(error.root)) {
                    reportedExpressions.add(error.root);
                    issues.warnings.push({
                        code: "UNSUPPORTED",
                        message: `${error.root}: the expression "${error.expression}" cannot be evaluated here, skipped with every token that uses it`,
                        path: error.root,
                    });
                }
                continue;
            }
            if (error instanceof AliasError) {
                if (error.code === "ALIAS_CYCLE") {
                    const key = error.message
                        .slice(error.message.indexOf(":") + 1)
                        .split(" -> ")
                        .slice(0, -1)
                        .sort()
                        .join("|");
                    if (reportedCycles.has(key)) continue;
                    reportedCycles.add(key);
                }
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
