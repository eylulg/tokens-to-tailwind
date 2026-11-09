import { describe, expect, it } from "vitest";
import { fixture, fixtureJson } from "./__fixtures__/load";
import { detectFormat, parseTokens } from "./index";

describe("detectFormat", () => {
    it.each([
        ["w3c.tokens.json", "w3c"],
        ["figma-variables.json", "figma"],
        ["figma-variables-resolved.json", "figma"],
        ["tokens-studio.json", "tokens-studio"],
    ])("detects %s as %s", (file, format) => {
        expect(detectFormat(fixtureJson(file))).toBe(format);
    });

    it("detects the REST API shape wrapped in meta", () => {
        expect(detectFormat({ meta: { variableCollections: {}, variables: {} } })).toBe("figma");
    });

    it("returns null for JSON that is not a tokens file", () => {
        expect(detectFormat(fixtureJson("unknown-format.json"))).toBeNull();
        expect(detectFormat([1, 2, 3])).toBeNull();
        expect(detectFormat("text")).toBeNull();
    });
});

describe("parseTokens", () => {
    it("reports invalid JSON", () => {
        const result = parseTokens(fixture("invalid.json.txt"));
        expect(result.format).toBeNull();
        expect(result.tokens).toEqual([]);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("INVALID_JSON");
        expect(result.errors[0].message).toMatch(/^The input is not valid JSON: /);
    });

    it("reports an unknown format", () => {
        const result = parseTokens(fixture("unknown-format.json"));
        expect(result.errors.map((e) => e.code)).toEqual(["UNKNOWN_FORMAT"]);
    });

    it("returns an empty result for empty input", () => {
        expect(parseTokens("   ")).toEqual({ format: null, tokens: [], errors: [], warnings: [] });
    });
});
