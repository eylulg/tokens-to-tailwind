import type { SourceFormat } from '@/model/tokens';
import figma from '@/parsers/__fixtures__/figma-variables.json?raw';
import tokensStudio from '@/parsers/__fixtures__/tokens-studio.json?raw';
import w3c from '@/parsers/__fixtures__/w3c.tokens.json?raw';

export interface Example {
  format: SourceFormat;
  label: string;
  fileName: string;
  text: string;
}

/** The parser fixtures double as the in-app examples, so what the tests cover is what users see. */
export const EXAMPLES: Example[] = [
  { format: 'w3c', label: 'W3C DTCG', fileName: 'tokens.json', text: w3c },
  { format: 'figma', label: 'Figma Variables', fileName: 'figma-variables.json', text: figma },
  {
    format: 'tokens-studio',
    label: 'Tokens Studio',
    fileName: 'tokens-studio.json',
    text: tokensStudio,
  },
];
