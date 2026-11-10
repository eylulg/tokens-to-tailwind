# Tokens to Tailwind

[![CI](https://github.com/eylulg/tokens-to-tailwind/actions/workflows/ci.yml/badge.svg)](https://github.com/eylulg/tokens-to-tailwind/actions/workflows/ci.yml)

Paste or drop a design tokens file, see every token as a swatch or type specimen, preview `@eylulg/ui` components themed with
those tokens, and export a Tailwind CSS 4 `theme.css` you can drop into an `@eylulg/ui` or plain Tailwind 4 project.

Everything runs in the browser. Nothing is uploaded.

**Live:** https://eylulg.github.io/tokens-to-tailwind/

## What it does

1. **Detects the format** of the pasted JSON (W3C DTCG, Figma Variables or Tokens Studio) and parses it with a typed parser.
2. **Resolves aliases** such as `{color.brand.600}`, follows chains, and reports unresolved aliases and cycles
   (`color.a -> color.b -> color.a`) as errors without dropping the valid tokens.
3. **Normalises** everything into one model:

    ```ts
    {
      name: "semantic.bg.primary",
      path: ["semantic", "bg", "primary"],
      type: "color", // color | dimension | fontFamily | fontSize | lineHeight | fontWeight | shadow | radius | spacing
      value: "#0c111d", // colors are lowercase hex, plus an oklch() string
      oklch: "oklch(17.9% 0.0261 266.47)",
      mode: "dark", // light | dark, absent for mode independent tokens
      alias: "color.gray.950",
    }
    ```

4. **Shows** the tokens grouped by type with search, a live preview of a card, a form, buttons and badges, and the export.
5. **Exports** a Tailwind 4 `theme.css` (an `@theme` block, plus a `.dark-mode` override in `@layer base` when the file has dark
   values), plain CSS custom properties, or the normalised JSON.

## Supported formats

### W3C Design Tokens Community Group

`$value` and `$type`, with `$type` inherited from groups. Colors can be CSS strings or the 2025 color object. Dimensions can be
`"16px"` or `{ "value": 16, "unit": "px" }`. Shadows and typography composites are supported. Light and dark values use the
`$extensions.mode` convention (Terrazzo, Cobalt UI).

```json
{
    "color": {
        "$type": "color",
        "brand": { "600": { "$value": "#444ce7" } },
        "bg": {
            "primary": {
                "$value": "{color.base.white}",
                "$extensions": { "mode": { "light": "{color.base.white}", "dark": "{color.gray.950}" } }
            }
        }
    }
}
```

### Figma Variables

Both the plugin API and REST API shape (`variableCollections` plus `variables` with `valuesByMode`) and the nested shape written
by "Variables Import/Export" style plugins (`collections[].modes` and `collections[].variables` with `resolvedValuesByMode`).
Color, number and string variables are read. Modes named like "Light" and "Dark" map to light and dark. Single mode collections are
mode independent. Numbers are classified as spacing, radius, font size, line height or font weight from the collection and
variable names.

```json
{
    "variableCollections": [
        {
            "id": "c1",
            "name": "Color modes",
            "modes": [
                { "modeId": "1:0", "name": "Light" },
                { "modeId": "1:1", "name": "Dark" }
            ]
        }
    ],
    "variables": [
        {
            "id": "v1",
            "name": "Background/bg-primary",
            "resolvedType": "COLOR",
            "variableCollectionId": "c1",
            "valuesByMode": {
                "1:0": { "r": 1, "g": 1, "b": 1, "a": 1 },
                "1:1": { "type": "VARIABLE_ALIAS", "id": "v2" }
            }
        }
    ]
}
```

### Tokens Studio for Figma

Lowercase `value` and `type`, sets listed in `$metadata.tokenSetOrder`, aliases as `{path}` or `$path`. Sets with "light" or
"dark" in their name become that mode. A file without `$metadata` is read as a single set.

```json
{
    "global": { "colors": { "violet": { "600": { "value": "#7c3aed", "type": "color" } } } },
    "light": { "bg": { "accent": { "value": "{colors.violet.600}", "type": "color" } } },
    "dark": { "bg": { "accent": { "value": "$colors.violet.400", "type": "color" } } },
    "$metadata": { "tokenSetOrder": ["global", "light", "dark"] }
}
```

Fixtures for all three formats live in [`src/parsers/__fixtures__`](src/parsers/__fixtures__) and double as the in-app examples.

## How the mapping works

| Token type   | Tailwind 4 variable                                                        | Example                               |
| ------------ | -------------------------------------------------------------------------- | ------------------------------------- |
| `color`      | `--color-*`                                                                | `--color-brand-600: oklch(...)`       |
| `spacing`    | `--spacing-*`                                                              | `--spacing-md: 12px`                  |
| `dimension`  | `--spacing-*` (when the path does not say otherwise)                       | `--spacing-icon: 20px`                |
| `radius`     | `--radius-*`                                                               | `--radius-lg: 12px`                   |
| `fontFamily` | `--font-*`                                                                 | `--font-body: Inter, sans-serif`      |
| `fontSize`   | `--text-*`                                                                 | `--text-md: 16px`                     |
| `lineHeight` | `--text-*--line-height` when a font size has that name, else `--leading-*` | `--text-md--line-height: 1.5`         |
| `fontWeight` | `--font-weight-*`, or `--text-*--font-weight` inside a typography token    | `--font-weight-semibold: 600`         |
| `shadow`     | `--shadow-*`                                                               | `--shadow-lg: 0px 12px 16px -4px ...` |

Naming rules:

- Path segments become kebab case and are joined with `-`. Groups that only repeat the namespace are dropped, so
  `color.brand.600` becomes `--color-brand-600`, not `--color-color-brand-600`, and `Spacing/spacing-md` becomes `--spacing-md`.
- **Keep full path** keeps every other segment. **Shorten to leaf** keeps the shortest trailing part that is still unique, and never
  a bare scale step: `semantic.bg.primary` becomes `--color-bg-primary`, `color.gray.500` stays `--color-gray-500`.
- Aliases become `var(--target)` when the target is exported too (switch off "Keep aliases as var()" for literal values).
- Light and mode independent values go into `@theme`. Dark values go into `@layer base { .dark-mode { ... } }`, the `.dark-mode` class
  that `@eylulg/ui` uses. Dark only tokens are also written to `@theme` so Tailwind creates their utilities.

Example output for the W3C fixture: [`src/generator/__snapshots__/w3c.theme.css`](src/generator/__snapshots__/w3c.theme.css).

### Using the export

```css
@import "tailwindcss";
@import "./theme.css";

/* Only needed without @eylulg/ui, which already defines it. */
@custom-variant dark (&:where(.dark-mode, .dark-mode *));
```

## Limitations

- Token types without a Tailwind 4 namespace are skipped with a warning: duration, cubic bezier, border, gradient, transition,
  opacity, boolean variables.
- Tokens Studio math expressions (`{spacing.base} * 2`) are not evaluated.
- Only two modes are supported: light and dark. Other Figma modes (for example "High contrast" or "Mobile") are skipped with a
  warning; a collection without a light or dark mode uses its first mode.
- The font family of a typography composite is not exported, since `--text-*` has no font family sub-property. Reference a
  `--font-*` token instead.
- Letter spacing, text decoration and text case are not mapped.
- The preview maps common scale names (`primary`, `accent`, `slate`, `neutral` and similar) onto the `@eylulg/ui` roles (`brand`, `gray`, `success`, `warning`, `error`, and semantic names such as `bg-primary`). Unusual names
  still export correctly but may not change the preview.

## Run it

Needs Node 20.19 or newer (CI uses Node 24).

`@eylulg/ui` is a `file:../ui` dependency until it is published: clone [eylulg/ui](https://github.com/eylulg/ui) next to this
folder and run `npm install && npm run build` in it before `npm install` here. CI checks the library out into `ui-src`, builds it and
installs it from there. Once the package is on npm the dependency becomes `^1.0.0`; the GitHub Pages and Vercel deploys need that
publish to build without the checkout. Locally the library is installed as a copy (`npm install ../ui --install-links`), so run `npm run relink` after rebuilding it.

```sh
npm install
npm run dev        # http://localhost:5173/tokens-to-tailwind/
npm run build      # type checks, then builds to dist/
npm run preview
```

## Tests and checks

```sh
npm test           # Vitest: parsers, generator snapshots, preview CSS, app (Testing Library + vitest-axe)
npm run typecheck
npm run lint       # ESLint 9 flat config with typescript-eslint, react-hooks and jsx-a11y
npm run format:check
npm run knip        # unused files, exports and dependencies
```

- Every parser has fixture based tests, including invalid JSON, unknown format, unresolved alias and alias cycles.
- Generator output is checked against snapshot files in `src/generator/__snapshots__/`. Update them with `npx vitest run -u`.
- App tests cover pasting a valid file, invalid JSON errors, the example buttons, export and copy, the preview, and run axe.

## Stack

Vite 7, React 19, TypeScript (strict), Tailwind CSS 4, the shared `@eylulg/ui` design system (React Aria Components, `tokens` theme variant), Zustand, culori for color conversion. Deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## License

[MIT](LICENSE) © Eylül Güneş
