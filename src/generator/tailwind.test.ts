import { describe, expect, it } from "vitest";
import type { Token } from "@/model/tokens";
import { fixture } from "@/parsers/__fixtures__/load";
import { parseTokens } from "@/parsers";
import { planTheme, toCssVariables, toJson, toScopedCss, toTailwindTheme } from "./index";

const parsed = (file: string) => {
    const result = parseTokens(fixture(file));
    expect(result.errors).toEqual([]);
    return result;
};

describe("toTailwindTheme snapshots", () => {
    it.each([
        ["w3c.tokens.json", "w3c"],
        ["figma-variables.json", "figma"],
        ["figma-variables-resolved.json", "figma-resolved"],
        ["tokens-studio.json", "tokens-studio"],
    ])("%s with path naming", async (file, name) => {
        const { tokens, format } = parsed(file);
        await expect(toTailwindTheme(tokens, { source: format })).toMatchFileSnapshot(`./__snapshots__/${name}.theme.css`);
    });

    it("w3c with leaf naming and hex colors", async () => {
        const { tokens, format } = parsed("w3c.tokens.json");
        await expect(toTailwindTheme(tokens, { source: format, naming: "leaf", colorFormat: "hex" })).toMatchFileSnapshot(
            "./__snapshots__/w3c.leaf-hex.theme.css",
        );
    });

    it("plain CSS variables", async () => {
        const { tokens, format } = parsed("tokens-studio.json");
        await expect(toCssVariables(tokens, { source: format })).toMatchFileSnapshot("./__snapshots__/tokens-studio.variables.css");
    });
});

const color = (name: string, value: string, extra: Partial<Token> = {}): Token => ({
    name,
    path: name.split("."),
    type: "color",
    value,
    oklch: `oklch(${value})`,
    ...extra,
});

describe("toTailwindTheme mapping", () => {
    it("maps every token type to its Tailwind 4 namespace", () => {
        const tokens: Token[] = [
            color("color.brand.500", "#6172f3"),
            { name: "space.md", path: ["space", "md"], type: "spacing", value: "12px" },
            { name: "size.icon", path: ["size", "icon"], type: "dimension", value: "20px" },
            { name: "radii.lg", path: ["radii", "lg"], type: "radius", value: "12px" },
            { name: "fontFamily.body", path: ["fontFamily", "body"], type: "fontFamily", value: "Inter" },
            { name: "fontSize.lg", path: ["fontSize", "lg"], type: "fontSize", value: "18px" },
            { name: "lineHeight.lg", path: ["lineHeight", "lg"], type: "lineHeight", value: "28px" },
            { name: "lineHeight.relaxed", path: ["lineHeight", "relaxed"], type: "lineHeight", value: "1.75" },
            { name: "fontWeight.medium", path: ["fontWeight", "medium"], type: "fontWeight", value: "500" },
            { name: "shadow.sm", path: ["shadow", "sm"], type: "shadow", value: "0 1px 2px 0 #0000000d" },
        ];
        const names = planTheme(tokens).base.map((d) => `${d.name}: ${d.value}`);
        expect(names).toEqual([
            "--color-brand-500: oklch(#6172f3)",
            "--font-body: Inter",
            "--text-lg: 18px",
            "--text-lg--line-height: 28px",
            "--font-weight-medium: 500",
            "--leading-relaxed: 1.75",
            "--spacing-md: 12px",
            "--spacing-icon: 20px",
            "--radius-lg: 12px",
            "--shadow-sm: 0 1px 2px 0 #0000000d",
        ]);
    });

    it("emits an unlayered .dark-mode block only when there are dark tokens", () => {
        const light = [color("bg.primary", "#ffffff", { mode: "light" })];
        expect(toTailwindTheme(light)).not.toContain("\n.dark-mode {");
        const both = [...light, color("bg.primary", "#0c111d", { mode: "dark" })];
        expect(toTailwindTheme(both)).toMatch(/\n\.dark-mode \{\n {4}\/\* Colors \*\/\n {4}--color-bg-primary: oklch\(#0c111d\);/);
    });

    it("puts dark-only tokens in @theme too, so Tailwind creates the utility", () => {
        const plan = planTheme([color("glow", "#ffffff", { mode: "dark" })]);
        expect(plan.base.map((d) => d.name)).toEqual(["--color-glow"]);
        expect(plan.dark.map((d) => d.name)).toEqual(["--color-glow"]);
    });

    it("writes aliases as var() references, or literal values when asked", () => {
        const tokens = [color("gray.900", "#101828"), color("text.primary", "#101828", { alias: "gray.900" })];
        expect(planTheme(tokens).base[1]?.value).toBe("var(--color-gray-900)");
        expect(planTheme(tokens, { preserveAliases: false, colorFormat: "hex" }).base[1]?.value).toBe("#101828");
    });

    it("shortens to unique leaves but keeps the parent of numeric steps", () => {
        const tokens = [
            color("color.gray.500", "#667085"),
            color("color.brand.500", "#6172f3"),
            color("semantic.bg.primary", "#ffffff"),
            color("semantic.text.primary", "#101828"),
            color("semantic.text.muted", "#667085"),
        ];
        expect(planTheme(tokens, { naming: "leaf" }).base.map((d) => d.name)).toEqual([
            "--color-gray-500",
            "--color-brand-500",
            "--color-bg-primary",
            "--color-text-primary",
            "--color-muted",
        ]);
    });

    it("strips redundant prefixes and trailing default segments", () => {
        const tokens: Token[] = [
            { name: "Spacing.spacing-md", path: ["Spacing", "spacing-md"], type: "spacing", value: "12px" },
            color("accent.default", "#17b26a"),
            color("Brand Colors.primaryDark", "#3538cd"),
        ];
        expect(planTheme(tokens).base.map((d) => d.name)).toEqual(["--color-accent", "--color-brand-colors-primary-dark", "--spacing-md"]);
    });

    it("warns when two tokens map to the same variable and keeps the first", () => {
        const plan = planTheme([color("color.brand", "#111111"), color("colors.brand", "#222222")]);
        expect(plan.base).toHaveLength(1);
        expect(plan.warnings).toEqual(["colors.brand and color.brand both map to --color-brand; kept color.brand"]);
    });
});

describe("other exports", () => {
    it("exports the normalised model as JSON", () => {
        const tokens = [color("a", "#000000")];
        expect(JSON.parse(toJson(tokens))).toEqual(tokens);
    });

    it("scopes declarations to a selector for the preview", () => {
        const css = toScopedCss([color("bg", "#ffffff", { mode: "light" }), color("bg", "#000000", { mode: "dark" })], "#preview", {
            colorFormat: "hex",
        });
        expect(css).toBe("#preview {\n    --color-bg: #ffffff;\n}\n.dark-mode #preview, #preview.dark-mode {\n    --color-bg: #000000;\n}");
    });
});

describe("naming details", () => {
    it("drops a group that the next segment repeats", () => {
        expect(planTheme([color("Text.text-primary", "#101828")]).base[0]?.name).toBe("--color-text-primary");
    });
});
