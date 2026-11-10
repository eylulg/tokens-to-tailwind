import { describe, expect, it } from "vitest";
import type { SourceFormat, TokenType } from "@/model/tokens";
import { fixture } from "./__fixtures__/load";
import { parseTokens } from "./index";

type Expected = Array<[name: string, type: TokenType, value: string]>;

const FILES: Array<[file: string, format: SourceFormat, errors: string[], warnings: number, expected: Expected]> = [
    [
        "real-world/real-w3c.tokens.json",
        "w3c",
        ["semantic.status.broken"],
        5,
        [
            ["font.size.md", "fontSize", "1rem"],
            ["font.line-height.tight", "lineHeight", "1.2"],
            ["dimension.space.4", "spacing", "16px"],
        ],
    ],
    [
        "real-world/real-figma-rest.json",
        "figma",
        ["Border.Ghost"],
        3,
        [
            ["Line height.body", "lineHeight", "24px"],
            ["Font weight.semibold", "fontWeight", "600"],
        ],
    ],
    [
        "real-world/real-tokens-studio.json",
        "tokens-studio",
        ["button.missing"],
        3,
        [
            ["spacing.lg", "spacing", "24px"],
            ["fontSizes.lg", "fontSize", "20px"],
            ["lineHeights.md", "lineHeight", "24px"],
        ],
    ],
    [
        "real-world/real-tokens-studio-dtcg.json",
        "tokens-studio",
        [],
        0,
        [
            ["spacing.base", "spacing", "4px"],
            ["spacing.md", "spacing", "16px"],
        ],
    ],
];

describe("real-world exports", () => {
    it.each(FILES)("%s parses with the expected tokens and issues", (file, format, errors, warnings, expected) => {
        const result = parseTokens(fixture(file));

        expect(result.format).toBe(format);
        expect(result.errors.map((e) => e.path)).toEqual(errors);
        expect(result.warnings).toHaveLength(warnings);
        for (const [name, type, value] of expected) {
            expect(result.tokens.find((t) => t.name === name)).toMatchObject({ type, value });
        }
    });
});
