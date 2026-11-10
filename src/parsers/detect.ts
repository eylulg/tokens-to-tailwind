import type { SourceFormat } from "@/model/tokens";
import { isPlainObject } from "./shared";

function someLeaf(node: unknown, test: (obj: Record<string, unknown>) => boolean, depth = 0): boolean {
    if (!isPlainObject(node) || depth > 12) return false;
    if (test(node)) return true;
    return Object.values(node).some((child) => someLeaf(child, test, depth + 1));
}

/** Works out which supported format a parsed JSON document is in, or `null`. */
export function detectFormat(json: unknown): SourceFormat | null {
    if (!isPlainObject(json)) return null;

    const root = isPlainObject(json.meta) ? json.meta : json;
    if ("variableCollections" in root && "variables" in root) return "figma";
    if (Array.isArray(root.collections) && root.collections.some((c) => isPlainObject(c) && "modes" in c && "variables" in c)) {
        return "figma";
    }

    // Tokens Studio now writes `$value` and `$type` too, so its set metadata decides before the W3C check.
    if ("$themes" in json || "$metadata" in json) return "tokens-studio";

    if (someLeaf(json, (obj) => "$value" in obj)) return "w3c";
    if (someLeaf(json, (obj) => "value" in obj && typeof obj.type === "string")) return "tokens-studio";

    return null;
}
