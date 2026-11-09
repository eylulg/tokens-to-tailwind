import type { Mode, ParseResult } from "@/model/tokens";
import type { RawEntry } from "./shared";
import { buildTokens, createIssues, isPlainObject } from "./shared";

/**
 * Parses the W3C Design Tokens Community Group format.
 *
 * - Tokens are objects with `$value`; `$type` is inherited from parent groups.
 * - Aliases use `{path.to.token}` and may omit `$type` (it comes from the target).
 * - Light and dark values can be given with the `$extensions.mode` convention
 *   (`{ "light": ..., "dark": ... }`), as used by Terrazzo and Cobalt UI.
 */
export function parseW3c(json: unknown): ParseResult {
    const issues = createIssues();
    const entries: RawEntry[] = [];

    const walk = (node: Record<string, unknown>, path: string[], inheritedType: string | undefined) => {
        const groupType = typeof node.$type === "string" ? node.$type : inheritedType;

        if ("$value" in node) {
            const modes = isPlainObject(node.$extensions) && isPlainObject(node.$extensions.mode) ? node.$extensions.mode : undefined;
            if (modes && ("light" in modes || "dark" in modes)) {
                for (const mode of ["light", "dark"] as Mode[]) {
                    const value = mode in modes ? modes[mode] : node.$value;
                    entries.push({ path, type: groupType, value, mode });
                }
            } else {
                entries.push({ path, type: groupType, value: node.$value });
            }
            return;
        }

        for (const [key, child] of Object.entries(node)) {
            if (key.startsWith("$")) continue;
            if (isPlainObject(child)) walk(child, [...path, key], groupType);
        }
    };

    if (isPlainObject(json)) walk(json, [], undefined);

    const tokens = buildTokens(entries, issues);
    return { format: "w3c", tokens, ...issues };
}
