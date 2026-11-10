import { describe, expect, it } from "vitest";
import { fixture, fixtureJson } from "./__fixtures__/load";
import { parseFigma, parseTokens } from "./index";

describe("parseFigma (valuesByMode, plugin and REST shape)", () => {
    const result = parseFigma(fixtureJson("figma-variables.json"));
    const find = (name: string, mode?: "light" | "dark") => result.tokens.find((t) => t.name === name && t.mode === mode);

    it("parses without errors and skips boolean variables with a warning", () => {
        expect(result.errors).toEqual([]);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]?.message).toContain("boolean variables are not supported");
    });

    it("converts 0 to 1 RGBA channels to hex and oklch", () => {
        expect(find("Colors.Brand.600")).toMatchObject({ type: "color", value: "#1570ef" });
        expect(find("Colors.Base.white")?.oklch).toBe("oklch(100% 0 0)");
    });

    it("treats single-mode collections as mode independent", () => {
        expect(find("Colors.Gray.900")?.mode).toBeUndefined();
    });

    it("maps Light mode and Dark mode to light and dark and resolves VARIABLE_ALIAS by id", () => {
        expect(find("Background.bg-primary", "light")).toMatchObject({ value: "#ffffff", alias: "Colors.Base.white" });
        expect(find("Background.bg-primary", "dark")).toMatchObject({ value: "#0c111d", alias: "Colors.Gray.950" });
    });

    it("classifies numbers by collection and variable name", () => {
        expect(find("spacing-md")).toMatchObject({ type: "spacing", value: "12px" });
        expect(find("radius-full")).toMatchObject({ type: "radius", value: "9999px" });
        expect(find("Font size.text-md")).toMatchObject({ type: "fontSize", value: "16px" });
        expect(find("Font family.font-family-body")).toMatchObject({ type: "fontFamily", value: "Inter" });
    });

    it("reports an alias to a variable that is not in the file", () => {
        const broken = parseTokens(fixture("figma-unresolved-alias.json"));
        expect(broken.format).toBe("figma");
        expect(broken.errors.map((e) => e.code)).toEqual(["UNRESOLVED_ALIAS"]);
        expect(broken.errors[0]?.message).toContain("VariableID:9:9");
    });

    it("detects alias cycles between variables", () => {
        const cyclic = parseFigma({
            variableCollections: [{ id: "c", name: "Tokens", modes: [{ modeId: "m", name: "Default" }] }],
            variables: [
                {
                    id: "a",
                    name: "a",
                    resolvedType: "COLOR",
                    variableCollectionId: "c",
                    valuesByMode: { m: { type: "VARIABLE_ALIAS", id: "b" } },
                },
                {
                    id: "b",
                    name: "b",
                    resolvedType: "COLOR",
                    variableCollectionId: "c",
                    valuesByMode: { m: { type: "VARIABLE_ALIAS", id: "a" } },
                },
            ],
        });
        expect(cyclic.errors.map((e) => e.code)).toEqual(["ALIAS_CYCLE", "ALIAS_CYCLE"]);
    });
});

describe("parseFigma (nested collections with resolvedValuesByMode)", () => {
    const result = parseFigma(fixtureJson("figma-variables-resolved.json"));
    const find = (name: string, mode?: "light" | "dark") => result.tokens.find((t) => t.name === name && t.mode === mode);

    it("keeps Light and Dark modes and warns about other modes", () => {
        expect(result.errors).toEqual([]);
        expect(result.warnings.map((w) => w.message)).toEqual([
            'Collection "Theme": modes "High contrast" are not light or dark and were skipped',
        ]);
        expect(result.tokens.filter((t) => t.name === "surface.default").map((t) => t.mode)).toEqual(["light", "dark"]);
    });

    it("uses aliasName to record the alias", () => {
        expect(find("accent.default", "dark")).toMatchObject({ value: "#5ed9c3", alias: "teal.300" });
    });

    it("keeps alpha from resolved values", () => {
        expect(find("overlay.scrim", "dark")?.value).toBe("#000000b3");
    });

    it("reads string, weight and line height variables", () => {
        expect(find("font.heading")).toMatchObject({ type: "fontFamily", value: '"Space Grotesk"' });
        expect(find("font-weight.heading")).toMatchObject({ type: "fontWeight", value: "600" });
        expect(find("line-height.heading")).toMatchObject({ type: "lineHeight", value: "1.2" });
    });

    it("uses only the first mode when no mode is light or dark", () => {
        const devices = parseFigma({
            collections: [
                {
                    name: "Layout",
                    modes: [
                        { modeId: "1", name: "Desktop" },
                        { modeId: "2", name: "Mobile" },
                    ],
                    variables: [{ name: "spacing/page", type: "FLOAT", valuesByMode: { 1: 32, 2: 16 } }],
                },
            ],
        });
        expect(devices.tokens).toEqual([{ name: "spacing.page", path: ["spacing", "page"], type: "spacing", value: "32px" }]);
        expect(devices.warnings[0]?.message).toContain('only "Desktop" was used');
    });
});
