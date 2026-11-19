import type { Mode, ParseResult } from '@/model/tokens';
import type { RawEntry } from './shared';
import { buildTokens, createIssues, isPlainObject, modeFromName } from './shared';

const TYPE_MAP: Record<string, string> = {
  color: 'color',
  spacing: 'spacing',
  borderRadius: 'radius',
  fontFamilies: 'fontFamily',
  fontFamily: 'fontFamily',
  fontSizes: 'fontSize',
  fontSize: 'fontSize',
  lineHeights: 'lineHeight',
  lineHeight: 'lineHeight',
  fontWeights: 'fontWeight',
  fontWeight: 'fontWeight',
  boxShadow: 'shadow',
  typography: 'typography',
  sizing: 'dimension',
  dimension: 'dimension',
  borderWidth: 'dimension',
  number: 'number',
};

/** Tokens Studio also accepts `$path.to.token` as an alias. Convert it to the brace form. */
function normaliseDollarAlias(value: unknown): unknown {
  if (typeof value === 'string' && /^\$[A-Za-z0-9_.-]+$/.test(value.trim()))
    return `{${value.trim().slice(1)}}`;
  if (Array.isArray(value)) return value.map(normaliseDollarAlias);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normaliseDollarAlias(v)]));
  }
  return value;
}

/** Tokens Studio writes `value` and `type`; since 2024 it writes `$value` and `$type` by default. */
function readToken(node: Record<string, unknown>): { value: unknown; type: string } | null {
  const type = typeof node.$type === 'string' ? node.$type : node.type;
  const value = '$value' in node ? node.$value : node.value;
  if (typeof type !== 'string' || (!('$value' in node) && !('value' in node))) return null;
  return { value, type };
}

/**
 * Parses Tokens Studio for Figma JSON.
 *
 * A multi-set file has `$metadata.tokenSetOrder` (and usually `$themes`) next to the
 * sets. Sets whose name contains "light" or "dark" become that mode. A file without
 * `$metadata` is treated as a single set.
 */
export function parseTokensStudio(json: unknown): ParseResult {
  const issues = createIssues();
  const entries: RawEntry[] = [];
  if (!isPlainObject(json)) return { format: 'tokens-studio', tokens: [], ...issues };

  const walk = (node: Record<string, unknown>, path: string[], mode: Mode | undefined) => {
    const token = readToken(node);
    if (token) {
      entries.push({
        path,
        type: TYPE_MAP[token.type] ?? token.type,
        value: normaliseDollarAlias(token.value),
        mode,
      });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (isPlainObject(child)) walk(child, [...path, key], mode);
    }
  };

  const metadata = isPlainObject(json.$metadata) ? json.$metadata : undefined;
  const setOrder =
    metadata && Array.isArray(metadata.tokenSetOrder)
      ? metadata.tokenSetOrder.filter((s) => typeof s === 'string')
      : undefined;

  if (setOrder) {
    for (const setName of setOrder) {
      const set = json[setName];
      if (isPlainObject(set)) walk(set, [], modeFromName(setName));
    }
  } else {
    walk(json, [], undefined);
  }

  const tokens = buildTokens(entries, issues, { math: true });
  return { format: 'tokens-studio', tokens, ...issues };
}
