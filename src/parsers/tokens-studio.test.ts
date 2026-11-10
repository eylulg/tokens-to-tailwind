import { describe, expect, it } from "vitest";
import { fixture, fixtureJson } from "./__fixtures__/load";
import { parseTokens, parseTokensStudio } from "./index";

describe("parseTokensStudio", () => {
    const result = parseTokensStudio(fixtureJson("tokens-studio.json"));
    const find = (name: string, mode?: "light" | "dark") => result.tokens.find((t) => t.name === name && t.mode === mode);

    it("parses every set in tokenSetOrder and skips unsupported types with a warning", () => {
        expect(result.errors).toEqual([]);
        expect(result.warnings.map((w) => w.path)).toEqual(["opacity.disabled"]);
    });

    it("drops the set name from the path and maps light and dark sets to modes", () => {
        expect(find("bg.canvas", "light")).toMatchObject({ value: "#ffffff", alias: "colors.white" });
        expect(find("bg.canvas", "dark")).toMatchObject({ value: "#0f172a", alias: "colors.slate.900" });
        expect(find("colors.violet.600")?.mode).toBeUndefined();
    });

    it("supports $path aliases as well as {path} aliases", () => {
        expect(find("fg.muted", "light")).toMatchObject({ value: "#334155", alias: "colors.slate.700" });
        expect(find("borderRadius.md")).toMatchObject({ type: "radius", value: "8px", alias: "spacing.2" });
    });

    it("maps Tokens Studio types and unitless numbers", () => {
        expect(find("spacing.4")).toMatchObject({ type: "spacing", value: "16px" });
        expect(find("fontFamilies.serif")).toMatchObject({ type: "fontFamily", value: "Fraunces, Georgia, serif" });
        expect(find("fontWeights.bold")).toMatchObject({ type: "fontWeight", value: "700" });
        expect(find("lineHeights.body")).toMatchObject({ type: "lineHeight", value: "150%" });
        expect(find("lineHeights.tight")).toMatchObject({ type: "lineHeight", value: "normal" });
    });

    it("converts box shadows, including inner shadows and aliased colors", () => {
        expect(find("boxShadow.card")?.value).toBe("0 1px 3px 0 #0f172a1a, 0 1px 2px -1px #0f172a0f");
        expect(find("boxShadow.inset")?.value).toBe("inset 0 2px 4px 0 #0f172a");
    });

    it("expands typography composites", () => {
        expect(result.tokens.filter((t) => t.name === "typography.heading").map((t) => `${t.type}=${t.value}`)).toEqual([
            "fontFamily=Fraunces, Georgia, serif",
            "fontSize=40px",
            "lineHeight=120%",
            "fontWeight=700",
        ]);
    });

    it("treats a file without $metadata as a single set", () => {
        const single = parseTokens(JSON.stringify({ brand: { primary: { value: "#7c3aed", type: "color" } } }));
        expect(single.format).toBe("tokens-studio");
        expect(single.tokens).toHaveLength(1);
    });

    it("detects alias cycles across both alias syntaxes", () => {
        const cyclic = parseTokens(fixture("tokens-studio-cycle.json"));
        expect(cyclic.errors.map((e) => e.code)).toEqual(["ALIAS_CYCLE", "ALIAS_CYCLE"]);
        expect(cyclic.errors[0]?.message).toContain("spacing.base -> spacing.double -> spacing.base");
    });
});

describe("parseTokensStudio math", () => {
    it("reports an expression it cannot evaluate once, without errors on the tokens that use it", () => {
        const result = parseTokensStudio({
            spacing: {
                base: { value: "4", type: "spacing" },
                odd: { value: "roundTo({spacing.base} * 2.5, 0)", type: "spacing" },
                wide: { value: "{spacing.odd}", type: "spacing" },
                wider: { value: "{spacing.wide}", type: "spacing" },
                sum: { value: "{spacing.base} + 8px", type: "spacing" },
            },
        });

        expect(result.errors).toEqual([]);
        expect(result.warnings.map((w) => w.path)).toEqual(["spacing.odd"]);
        expect(result.tokens.find((t) => t.name === "spacing.sum")?.value).toBe("12px");
    });
});
