import { describe, expect, it } from "vitest";
import type { Token } from "@/model/tokens";
import { buildPreviewCss } from "./preview-css";

const color = (name: string, value: string, mode?: "light" | "dark"): Token => ({
    name,
    path: name.split("."),
    type: "color",
    value,
    ...(mode ? { mode } : {}),
});

describe("buildPreviewCss", () => {
    it("re-declares Untitled UI semantic variables inside the scope", () => {
        const css = buildPreviewCss([], "#p", {});
        expect(css).toContain("--color-bg-brand-solid: var(--color-brand-600);");
        expect(css).toMatch(/\n#p\.dark-mode \{/);
        expect(css).not.toContain(".dark-mode #p");
    });

    it("maps a primary scale and single semantic colors to Untitled roles", () => {
        const css = buildPreviewCss([color("primary.600", "#7c3aed"), color("surface", "#ffffff"), color("fg", "#0f172a")], "#p", {
            colorFormat: "hex",
        });
        expect(css).toContain("--color-brand-600: var(--color-primary-600);");
        expect(css).toContain("--color-bg-primary: var(--color-surface);");
        expect(css).toContain("--color-text-primary: var(--color-fg);");
        expect(css).toContain("--color-primary-600: #7c3aed;");
    });

    it("puts dark values in the dark rule", () => {
        const css = buildPreviewCss([color("bg.primary", "#fff", "light"), color("bg.primary", "#000", "dark")], "#p", {
            colorFormat: "hex",
        });
        const darkRule = css.slice(css.indexOf("#p.dark-mode"));
        expect(darkRule).toContain("--color-bg-primary: #000;");
    });
});
