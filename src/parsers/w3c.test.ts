import { describe, expect, it } from "vitest";
import { fixture, fixtureJson } from "./__fixtures__/load";
import { parseTokens, parseW3c } from "./index";

const find = (result: ReturnType<typeof parseW3c>, name: string, mode?: "light" | "dark") =>
    result.tokens.find((t) => t.name === name && t.mode === mode);

describe("parseW3c", () => {
    const result = parseW3c(fixtureJson("w3c.tokens.json"));

    it("parses without errors and reports unsupported types as warnings", () => {
        expect(result.format).toBe("w3c");
        expect(result.errors).toEqual([]);
        expect(result.warnings.map((w) => w.path)).toEqual(["motion.duration.fast"]);
    });

    it("inherits $type from groups and normalises colors to hex and oklch", () => {
        expect(find(result, "color.brand.600")).toEqual({
            name: "color.brand.600",
            path: ["color", "brand", "600"],
            type: "color",
            value: "#444ce7",
            oklch: "oklch(51.47% 0.2287 272.81)",
        });
    });

    it("reads DTCG 2025 color objects, oklch strings and colors with alpha", () => {
        expect(find(result, "color.success.500")?.value).toBe("#17b26a");
        expect(find(result, "color.error.500")?.oklch).toBe("oklch(63.68% 0.2078 25.33)");
        expect(find(result, "color.overlay")?.value).toBe("#0c111db3");
        expect(find(result, "color.overlay")?.oklch).toMatch(/ \/ 0\.7\)$/);
    });

    it("resolves aliases and remembers the alias target", () => {
        const display = find(result, "font.family.display");
        expect(display?.value).toBe('Inter, -apple-system, "Segoe UI", sans-serif');
        expect(display?.alias).toBe("font.family.body");
    });

    it("splits $extensions.mode into light and dark tokens", () => {
        expect(find(result, "semantic.bg.primary", "light")?.value).toBe("#ffffff");
        expect(find(result, "semantic.bg.primary", "dark")).toMatchObject({ value: "#0c111d", alias: "color.gray.950" });
        // A missing light entry falls back to $value.
        expect(find(result, "semantic.border.primary", "light")?.value).toBe("#d0d5dd");
    });

    it("classifies dimensions by path and reads { value, unit } objects", () => {
        expect(find(result, "spacing.xl")).toMatchObject({ type: "spacing", value: "1.5rem" });
        expect(find(result, "radius.lg")).toMatchObject({ type: "radius", value: "12px" });
    });

    it("normalises font weights, typography composites and shadows", () => {
        expect(find(result, "font.weight.semibold")).toMatchObject({ type: "fontWeight", value: "600" });
        const parts = result.tokens.filter((t) => t.name === "typography.display-sm").map((t) => [t.type, t.value]);
        expect(parts).toEqual([
            ["fontFamily", 'Inter, -apple-system, "Segoe UI", sans-serif'],
            ["fontSize", "30px"],
            ["lineHeight", "1.2667"],
            ["fontWeight", "600"],
        ]);
        expect(find(result, "shadow.lg")?.value).toBe("0px 12px 16px -4px #10182814, 0px 4px 6px -2px #10182808");
    });

    it("reports an unresolved alias as an error and keeps the other tokens", () => {
        const broken = parseTokens(fixture("w3c-unresolved-alias.json"));
        expect(broken.errors).toEqual([
            {
                code: "UNRESOLVED_ALIAS",
                message: "color.accent: Alias {color.brnad} does not point to an existing token",
                path: "color.accent",
            },
        ]);
        expect(broken.tokens.map((t) => t.name)).toEqual(["color.brand"]);
    });

    it("detects alias cycles", () => {
        const cyclic = parseTokens(fixture("w3c-cycle.json"));
        expect(cyclic.errors.map((e) => e.code)).toEqual(["ALIAS_CYCLE", "ALIAS_CYCLE", "ALIAS_CYCLE"]);
        expect(cyclic.errors[0].message).toBe("color.a: Alias cycle detected: color.a -> color.b -> color.c -> color.a");
        expect(cyclic.tokens.map((t) => t.name)).toEqual(["color.ok"]);
    });

    it("reports values that do not match their type", () => {
        const bad = parseW3c({
            color: { $type: "color", nope: { $value: "not-a-color" } },
            size: { $type: "dimension", x: { $value: "wide" } },
        });
        expect(bad.errors.map((e) => [e.code, e.path])).toEqual([
            ["INVALID_VALUE", "color.nope"],
            ["INVALID_VALUE", "size.x"],
        ]);
    });
});
