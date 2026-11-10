import type { Mode, ParseResult } from "@/model/tokens";
import { classifyByPath } from "@/model/values";
import type { Issues, RawEntry } from "./shared";
import { buildTokens, createIssues, isPlainObject, modeFromName } from "./shared";

interface FigmaMode {
    id: string;
    name: string;
}

interface FigmaCollection {
    id?: string;
    name: string;
    modes: FigmaMode[];
}

interface FigmaVariable {
    id?: string;
    name: string;
    type: string;
    collection: FigmaCollection;
    /** Keyed by mode id or mode name, exactly as found in the file. */
    values: Record<string, unknown>;
    /** True when values came from `resolvedValuesByMode`. */
    resolvedShape: boolean;
}

function toList(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) return value.filter(isPlainObject);
    if (isPlainObject(value)) return Object.values(value).filter(isPlainObject);
    return [];
}

function readModes(raw: unknown): FigmaMode[] {
    if (Array.isArray(raw)) {
        return raw.filter(isPlainObject).map((m, i) => {
            const name = typeof m.name === "string" ? m.name : `Mode ${i + 1}`;
            const id = typeof m.modeId === "string" ? m.modeId : typeof m.id === "string" ? m.id : name;
            return { id, name };
        });
    }
    // Some exports use `{ "1:0": "Light", "1:1": "Dark" }`.
    if (isPlainObject(raw)) {
        return Object.entries(raw).map(([id, name]) => ({ id, name: typeof name === "string" ? name : id }));
    }
    return [];
}

function readVariable(raw: Record<string, unknown>, collection: FigmaCollection): FigmaVariable | null {
    if (typeof raw.name !== "string") return null;
    const type = String(raw.resolvedType ?? raw.type ?? "").toUpperCase();
    const resolvedShape = isPlainObject(raw.resolvedValuesByMode);
    const values = (resolvedShape ? raw.resolvedValuesByMode : raw.valuesByMode) as Record<string, unknown> | undefined;
    if (!isPlainObject(values)) return null;
    return { id: typeof raw.id === "string" ? raw.id : undefined, name: raw.name, type, collection, values, resolvedShape };
}

/** Reads both the flat plugin/REST shape and the nested "collections with variables" shape. */
function readFile(json: Record<string, unknown>): FigmaVariable[] {
    const root = isPlainObject(json.meta) ? json.meta : json;
    const variables: FigmaVariable[] = [];

    if ("variableCollections" in root) {
        const collections = new Map<string, FigmaCollection>();
        for (const c of toList(root.variableCollections)) {
            const id = typeof c.id === "string" ? c.id : String(c.name);
            collections.set(id, { id, name: typeof c.name === "string" ? c.name : id, modes: readModes(c.modes) });
        }
        for (const v of toList(root.variables)) {
            const collection = collections.get(String(v.variableCollectionId));
            if (!collection) continue;
            const variable = readVariable(v, collection);
            if (variable) variables.push(variable);
        }
        return variables;
    }

    for (const c of toList(root.collections)) {
        const name = typeof c.name === "string" ? c.name : "Collection";
        const collection: FigmaCollection = { id: typeof c.id === "string" ? c.id : name, name, modes: readModes(c.modes) };
        for (const v of toList(c.variables)) {
            const variable = readVariable(v, collection);
            if (variable) variables.push(variable);
        }
    }
    return variables;
}

/**
 * Picks which collection modes to emit and how they map to light and dark.
 * One mode: mode independent. Light/Dark modes: mapped. Anything else: the first mode only.
 */
function planModes(collection: FigmaCollection, issues: Issues, warned: Set<string>): { mode: FigmaMode; as: Mode | undefined }[] {
    if (collection.modes.length <= 1) return collection.modes.map((mode) => ({ mode, as: undefined }));
    const mapped = collection.modes.map((mode) => ({ mode, as: modeFromName(mode.name) })).filter((m) => m.as !== undefined);
    if (mapped.length > 0) {
        const skipped = collection.modes.filter((m) => !mapped.some((x) => x.mode.id === m.id));
        if (skipped.length && !warned.has(collection.name)) {
            warned.add(collection.name);
            issues.warnings.push({
                code: "UNSUPPORTED",
                message: `Collection "${collection.name}": modes ${skipped.map((m) => `"${m.name}"`).join(", ")} are not light or dark and were skipped`,
            });
        }
        return mapped;
    }
    const [first] = collection.modes;
    if (!first) return [];
    if (!warned.has(collection.name)) {
        warned.add(collection.name);
        issues.warnings.push({
            code: "UNSUPPORTED",
            message: `Collection "${collection.name}": modes are not named light or dark, only "${first.name}" was used`,
        });
    }
    return [{ mode: first, as: undefined }];
}

const SIZE_ROLE = /size|sizing|dimension|width|height|spacing|space|gap|padding|margin|inset|stroke|border|icon/i;

function figmaType(variable: FigmaVariable, path: string[]): string | null {
    const hintPath = [variable.collection.name, ...path];
    switch (variable.type) {
        case "COLOR":
            return "color";
        case "FLOAT":
        case "NUMBER": {
            const type = classifyByPath(hintPath, "dimension");
            // A bare number such as `Grid/columns` is a count, not a length.
            return type === "dimension" && !SIZE_ROLE.test(hintPath.join("/")) ? null : type;
        }
        case "STRING": {
            const type = classifyByPath(hintPath, "dimension");
            if (type === "fontWeight" || type === "fontFamily") return type;
            return type === "dimension" && /font|family/i.test(path.join("/")) ? "fontFamily" : null;
        }
        default:
            return null;
    }
}

/**
 * Parses Figma Variables exports, as produced by the plugin API, the REST API
 * (`/v1/files/:key/variables/local`) and "Variables Import/Export" style community plugins.
 */
export function parseFigma(json: unknown): ParseResult {
    const issues = createIssues();
    if (!isPlainObject(json)) return { format: "figma", tokens: [], ...issues };

    const variables = readFile(json);
    const byId = new Map(variables.filter((v) => v.id).map((v) => [v.id as string, v]));
    const toPath = (name: string) =>
        name
            .split("/")
            .map((s) => s.trim())
            .filter(Boolean);
    const warned = new Set<string>();
    const entries: RawEntry[] = [];

    const aliasRef = (id: unknown, aliasName: unknown): string | null => {
        if (typeof aliasName === "string") return `{${toPath(aliasName).join(".")}}`;
        if (typeof id !== "string") return null;
        const target = byId.get(id);
        return `{${target ? toPath(target.name).join(".") : id}}`;
    };

    for (const variable of variables) {
        const path = toPath(variable.name);
        const type = figmaType(variable, path);
        if (!type) {
            issues.warnings.push({
                code: "UNSUPPORTED",
                message:
                    variable.type === "FLOAT" || variable.type === "NUMBER"
                        ? `${path.join(".")}: number has no recognisable role (size, spacing, radius, font), skipped`
                        : `${path.join(".")}: ${variable.type.toLowerCase()} variables are not supported, skipped`,
                path: path.join("."),
            });
            continue;
        }
        for (const { mode, as } of planModes(variable.collection, issues, warned)) {
            const raw = variable.values[mode.id] ?? variable.values[mode.name];
            if (raw === undefined) continue;
            let value: unknown = raw;
            if (variable.resolvedShape && isPlainObject(raw)) {
                value = raw.alias || raw.aliasName ? aliasRef(raw.alias, raw.aliasName) : raw.resolvedValue;
            } else if (isPlainObject(raw) && raw.type === "VARIABLE_ALIAS") {
                value = aliasRef(raw.id, raw.name);
            }
            entries.push({ path, type, value, mode: as });
        }
    }

    const tokens = buildTokens(entries, issues);
    return { format: "figma", tokens, ...issues };
}
