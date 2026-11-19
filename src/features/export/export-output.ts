import type { ThemeOptions } from '@/generator';
import { toCssVariables, toJson, toTailwindTheme } from '@/generator';
import type { Token } from '@/model/tokens';
import type { ExportFormat } from '@/store/use-app-store';

export const EXPORT_FILES: Record<ExportFormat, { fileName: string; mime: string; label: string }> =
  {
    tailwind: { fileName: 'theme.css', mime: 'text/css', label: 'Tailwind 4 theme.css' },
    css: { fileName: 'tokens.css', mime: 'text/css', label: 'CSS custom properties' },
    json: { fileName: 'tokens.json', mime: 'application/json', label: 'Normalised JSON' },
  };

export function renderExport(format: ExportFormat, tokens: Token[], options: ThemeOptions): string {
  if (format === 'json') return toJson(tokens);
  if (format === 'css') return toCssVariables(tokens, options);
  return toTailwindTheme(tokens, options);
}
