# Tokens to Tailwind

Paste a design tokens file and see every token as a swatch or type specimen, preview `@eylulg/ui` components themed with it, and export a Tailwind CSS 4 `theme.css`. It reads W3C Design Tokens, Figma Variables and Tokens Studio files. Everything runs in the browser and nothing is uploaded.

Live: https://eylulg.github.io/tokens-to-tailwind/

## Run it

You need Node 20.19 or newer. The design system `@eylulg/ui` is a local dependency (`file:../ui`), so build it next to this repo first.

```sh
git clone https://github.com/eylulg/ui ../ui && (cd ../ui && npm install && npm run build)
npm install
npm run dev        # http://localhost:5173/tokens-to-tailwind/
```

After rebuilding the library, run `npm run relink`. Fixtures for the three formats are in [`src/parsers/__fixtures__`](src/parsers/__fixtures__) and are also the in-app examples.

## How it works

The parser detects the format, resolves aliases (chains work, unresolved aliases and cycles are reported as errors, valid tokens are kept) and turns everything into one token model. Tokens can be colours, dimensions, font families, sizes, line heights and weights, shadows, radii and spacing. Colours are stored as hex and as `oklch()`.

You can export `theme.css`, plain CSS custom properties or the normalised JSON. In `theme.css`, colours go to `--color-*`, spacing to `--spacing-*`, radii to `--radius-*`, font families to `--font-*`, font sizes to `--text-*`, and shadows to `--shadow-*`. Names can keep the full token path or be shortened to the shortest unique tail. Aliases become `var()` references when the target is exported too.

Import the result after Tailwind:

```css
@import 'tailwindcss';
@import './theme.css';

/* Only without @eylulg/ui, which already defines it. */
@custom-variant dark (&:where(.dark-mode, .dark-mode *));
```

Example output: [`src/generator/__snapshots__/w3c.theme.css`](src/generator/__snapshots__/w3c.theme.css).

## Decisions

**Values are written twice.** Tailwind puts `@theme` in a layer, and an `@eylulg/ui` variant file writes plain `:root` rules, which beat any layer. So the file has an `@theme` block for the utilities and unlayered `:root` and `.dark-mode` blocks so the values win. The cost is a longer file.

**Only light and dark.** Other Figma modes (high contrast, mobile) are skipped with a warning. Supporting arbitrary modes would need a different output shape.

**A name guess for the preview.** The preview maps common scale names (`primary`, `accent`, `slate`) onto `@eylulg/ui` roles. Unusual names still export correctly but may not change the preview.

## Limits

- Token types with no Tailwind 4 namespace are skipped with a warning: duration, cubic bezier, border, gradient, transition, opacity, boolean.
- Tokens Studio math with `+ - * /` and parentheses is evaluated. Anything else is skipped with a warning.
- The font family inside a typography composite is not exported. Letter spacing, text decoration and text case are not mapped.

## Tests

Every parser has fixture based tests, including invalid JSON, unresolved aliases and cycles. The generator is checked against snapshot files (update with `npx vitest run -u`), and the app tests paste, export, preview and run axe.

```sh
npm run typecheck && npm run lint && npm run format:check && npm run knip && npm test
npm run build
```

## Deploy

CI runs the checks above and the build. The deploy workflow publishes `dist` to GitHub Pages with base `/tokens-to-tailwind/`. Both workflows check out `eylulg/ui` into `ui-src` and build it first, because the library is a local dependency. No environment variables are needed.

## License

[MIT](LICENSE), Eylül Güneş
