import type { ParseResult, SourceFormat } from '@/model/tokens';
import { FORMAT_LABELS } from '@/model/tokens';
import { detectFormat } from './detect';
import { parseFigma } from './figma';
import { parseTokensStudio } from './tokens-studio';
import { parseW3c } from './w3c';

export { detectFormat } from './detect';
export { parseFigma } from './figma';
export { parseTokensStudio } from './tokens-studio';
export { parseW3c } from './w3c';

const PARSERS: Record<SourceFormat, (json: unknown) => ParseResult> = {
  w3c: parseW3c,
  figma: parseFigma,
  'tokens-studio': parseTokensStudio,
};

/** Parses a tokens file of any supported format. Never throws: problems come back as errors. */
export function parseTokens(text: string): ParseResult {
  const empty: ParseResult = { format: null, tokens: [], errors: [], warnings: [] };
  if (text.trim() === '') return empty;

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ...empty,
      errors: [{ code: 'INVALID_JSON', message: `The input is not valid JSON: ${detail}` }],
    };
  }

  const format = detectFormat(json);
  if (!format) {
    return {
      ...empty,
      errors: [
        {
          code: 'UNKNOWN_FORMAT',
          message: `Could not recognise the format. Supported: ${Object.values(FORMAT_LABELS).join(', ')}.`,
        },
      ],
    };
  }
  return PARSERS[format](json);
}
