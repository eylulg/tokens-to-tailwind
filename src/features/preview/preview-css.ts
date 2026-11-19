import type { ThemeOptions } from '@/generator';
import { planTheme, roleMappings } from '@/generator';
import { LIBRARY_VARIABLES } from '@/generator/roles';
import type { Token } from '@/model/tokens';

/**
 * CSS that themes everything inside `scope` with the parsed tokens, plus the names it mapped onto
 * library roles. The dark rule only applies when the scope itself has `.dark-mode`, so the
 * preview toggle is independent of the page theme.
 */
export function buildPreview(
  tokens: Token[],
  scope: string,
  options: ThemeOptions,
): { css: string; notes: string[] } {
  const plan = planTheme(tokens, { ...options, preserveAliases: true });
  const line = (text: string) => `    ${text}`;
  const decl = (d: { name: string; value: string }) => line(`${d.name}: ${d.value};`);
  const light = roleMappings(plan.base);
  const dark = roleMappings(plan.dark);

  const lightLines = [
    ...LIBRARY_VARIABLES.light.map(line),
    ...light.theme.map(decl),
    ...light.ui.map(decl),
    ...plan.base.map(decl),
  ];
  const darkLines = [
    ...LIBRARY_VARIABLES.dark.map(line),
    ...dark.ui.map(decl),
    ...plan.dark.map(decl),
  ];

  return {
    css: [
      `${scope} {\n${lightLines.join('\n')}\n}`,
      `${scope}.dark-mode {\n${darkLines.join('\n')}\n}`,
    ].join('\n'),
    notes: light.notes,
  };
}
