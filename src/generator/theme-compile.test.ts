import fs from 'node:fs';
import path from 'node:path';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import { fixture } from '@/parsers/__fixtures__/load';
import { parseTokens } from '@/parsers';
import { toTailwindTheme } from './index';

const NODE_MODULES = path.join(process.cwd(), 'node_modules');
const LIBRARY = path.join(NODE_MODULES, '@eylulg/ui/dist');

/** Compiles the way an @eylulg/ui app does: Tailwind, the library theme, a variant, then the export. */
async function compileApp(themeCss: string): Promise<string> {
  const entry = [
    '@import "tailwindcss";',
    '@import "@eylulg/ui/theme.css";',
    '@import "@eylulg/ui/themes/tokens.css";',
    '@import "./theme.css";',
  ].join('\n');
  const compiled = await compile(entry, {
    base: NODE_MODULES,
    async loadStylesheet(id, base) {
      if (id === './theme.css') return { base, path: 'theme.css', content: themeCss };
      const file = id.startsWith('@eylulg/ui/')
        ? path.join(LIBRARY, id.slice('@eylulg/ui/'.length))
        : path.join(NODE_MODULES, id === 'tailwindcss' ? 'tailwindcss/index.css' : id);
      return { base: path.dirname(file), path: file, content: fs.readFileSync(file, 'utf8') };
    },
  });
  return compiled.build(['bg-brand-600', 'bg-primary', 'text-primary']);
}

/** Top-level rules that are not inside a cascade layer, which always beat layered ones. */
function unlayeredDeclarations(css: string, selector: RegExp): Map<string, string> {
  let flat = css;
  for (let match = /@layer [\w.-]+ \{/.exec(flat); match; match = /@layer [\w.-]+ \{/.exec(flat)) {
    let depth = 1;
    let end = match.index + match[0].length;
    while (depth > 0 && end < flat.length)
      depth += flat[end++] === '{' ? 1 : flat[end - 1] === '}' ? -1 : 0;
    flat = flat.slice(0, match.index) + flat.slice(end);
  }
  const declarations = new Map<string, string>();
  for (const [, selectors, body] of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors || !body || !selector.test(selectors.trim())) continue;
    for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g))
      if (name && value) declarations.set(name, value.trim());
  }
  return declarations;
}

function resolveVar(declarations: Map<string, string>, name: string): string | undefined {
  const value = declarations.get(name);
  const reference = value ? /^var\((--[\w-]+)\)$/.exec(value) : null;
  return reference?.[1] ? resolveVar(declarations, reference[1]) : value;
}

describe('theme.css in an @eylulg/ui app with a variant', () => {
  const variant = unlayeredDeclarations(
    fs.readFileSync(path.join(LIBRARY, 'themes/tokens.css'), 'utf8'),
    /^:root/,
  );

  it("changes --color-brand-600 from the variant's value to the exported one", async () => {
    const { tokens } = parseTokens(fixture('w3c.tokens.json'));
    const css = await compileApp(toTailwindTheme(tokens));
    const exported = resolveVar(unlayeredDeclarations(css, /^:root/), '--color-brand-600');

    expect(exported).toBe('oklch(51.47% 0.2287 272.81)');
    expect(exported).not.toBe(variant.get('--color-brand-600'));
  });

  it('applies the exported dark values in an unlayered .dark-mode rule', async () => {
    const { tokens } = parseTokens(fixture('tokens-studio.json'));
    const css = await compileApp(toTailwindTheme(tokens));
    const dark = unlayeredDeclarations(css, /^\.dark-mode$/);

    expect(resolveVar(dark, '--color-bg-canvas')).toBe(resolveVar(dark, '--color-slate-900'));
    expect(dark.get('--ui-bg-primary')).toBe('var(--color-bg-canvas)');
  });
});
