import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { Input } from '@eylulg/ui/input';
import { Search } from 'lucide-react';
import type { Token, TokenType } from '@/model/tokens';
import { TOKEN_TYPES, countTokens } from '@/model/tokens';

const TYPE_TITLES: Record<TokenType, string> = {
  color: 'Colors',
  fontFamily: 'Font families',
  fontSize: 'Font sizes',
  lineHeight: 'Line heights',
  fontWeight: 'Font weights',
  spacing: 'Spacing',
  dimension: 'Other dimensions',
  radius: 'Radius',
  shadow: 'Shadows',
};

const DISPLAY_ORDER: TokenType[] = [
  'color',
  'fontFamily',
  'fontSize',
  'lineHeight',
  'fontWeight',
  'spacing',
  'radius',
  'shadow',
  'dimension',
];

interface Row {
  key: string;
  name: string;
  type: TokenType;
  base?: Token;
  dark?: Token;
}

function groupRows(tokens: Token[]): Map<TokenType, Row[]> {
  const rows = new Map<string, Row>();
  for (const token of tokens) {
    const key = `${token.type}|${token.name}`;
    const row = rows.get(key) ?? { key, name: token.name, type: token.type };
    if (token.mode === 'dark') row.dark = token;
    else row.base = token;
    rows.set(key, row);
  }
  const grouped = new Map<TokenType, Row[]>(TOKEN_TYPES.map((t) => [t, []]));
  for (const row of rows.values()) grouped.get(row.type)?.push(row);
  return grouped;
}

function matches(row: Row, query: string): boolean {
  if (!query) return true;
  const haystack = [
    row.name,
    row.base?.value,
    row.dark?.value,
    row.base?.oklch,
    row.base?.alias,
    row.dark?.alias,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function ColorChip({ token, label }: { token: Token; label: string }) {
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <div
        aria-hidden='true'
        className='h-14 w-full rounded-lg ring-1 ring-default ring-inset'
        style={{ background: token.value }}
      />
      <dl className='min-w-0 text-xs text-tertiary'>
        <dt className='sr-only'>{label} hex</dt>
        <dd className='font-mono text-secondary'>{token.value}</dd>
        <dt className='sr-only'>{label} oklch</dt>
        <dd className='truncate font-mono' title={token.oklch}>
          {token.oklch}
        </dd>
        {token.alias && (
          <>
            <dt className='sr-only'>{label} alias of</dt>
            <dd className='truncate'>alias of {token.alias}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function Specimen({ token }: { token: Token }) {
  const sample = 'The quick brown fox';
  const style: Record<TokenType, CSSProperties> = {
    color: {},
    fontFamily: { fontFamily: token.value },
    fontSize: { fontSize: token.value, lineHeight: 1.2 },
    lineHeight: { lineHeight: token.value },
    fontWeight: { fontWeight: Number(token.value) },
    spacing: {},
    dimension: {},
    radius: {},
    shadow: {},
  };
  switch (token.type) {
    case 'spacing':
    case 'dimension':
      return (
        <div
          aria-hidden='true'
          className='h-3 max-w-full rounded-sm bg-brand-solid'
          style={{ width: token.value }}
        />
      );
    case 'radius':
      return (
        <div
          aria-hidden='true'
          className='size-14 border-2 border-brand bg-brand-subtle'
          style={{ borderRadius: token.value }}
        />
      );
    case 'shadow':
      return (
        <div
          aria-hidden='true'
          className='size-14 rounded-lg bg-primary ring-1 ring-default'
          style={{ boxShadow: token.value }}
        />
      );
    case 'lineHeight':
      return (
        <p
          aria-hidden='true'
          className='max-w-56 bg-secondary text-sm text-secondary'
          style={style.lineHeight}
        >
          {sample} jumps over the lazy dog.
        </p>
      );
    default:
      return (
        <p aria-hidden='true' className='truncate text-xl text-primary' style={style[token.type]}>
          {sample}
        </p>
      );
  }
}

function TokenCard({ row }: { row: Row }) {
  const isColor = row.type === 'color';
  return (
    <li className='flex min-w-0 flex-col gap-3 rounded-xl bg-primary p-3 ring-1 ring-default ring-inset'>
      <p className='truncate font-mono text-xs font-medium text-primary' title={row.name}>
        {row.name}
      </p>
      {isColor ? (
        <div className={row.dark && row.base ? 'grid grid-cols-2 gap-2' : 'grid'}>
          {row.base && <ColorChip token={row.base} label={row.dark ? 'Light' : 'Value'} />}
          {row.dark && <ColorChip token={row.dark} label='Dark' />}
        </div>
      ) : (
        <>
          {row.base && <Specimen token={row.base} />}
          <p className='font-mono text-xs break-all text-tertiary'>
            {row.base?.value}
            {row.dark && ` / dark: ${row.dark.value}`}
          </p>
        </>
      )}
      {(row.base?.mode || row.dark) && (
        <p className='text-xs text-tertiary'>
          {row.dark && row.base ? 'Light and dark' : row.dark ? 'Dark only' : 'Light'}
        </p>
      )}
    </li>
  );
}

export function TokensTab({ tokens }: { tokens: Token[] }) {
  const [query, setQuery] = useState('');
  const grouped = useMemo(() => groupRows(tokens), [tokens]);
  const normalised = query.trim().toLowerCase();
  const visible = DISPLAY_ORDER.map((type) => ({
    type,
    rows: (grouped.get(type) ?? []).filter((row) => matches(row, normalised)),
  })).filter((g) => g.rows.length > 0);
  const total = visible.reduce((sum, g) => sum + g.rows.length, 0);

  if (tokens.length === 0) {
    return (
      <p className='rounded-xl bg-secondary p-6 text-sm text-tertiary'>
        No tokens yet. Paste a file or load an example to see swatches here.
      </p>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      <Input
        label='Search tokens'
        placeholder='Name, value or alias'
        iconLeading={Search}
        value={query}
        onChange={setQuery}
        size='sm'
      />
      <p role='status' className='text-sm text-tertiary'>
        {normalised ? `${total} of ${countTokens(tokens)} tokens match` : `${total} tokens`}
      </p>
      {visible.map(({ type, rows }) => (
        <section key={type} aria-labelledby={`group-${type}`} className='flex flex-col gap-3'>
          <h3 id={`group-${type}`} className='text-md font-semibold text-primary'>
            {TYPE_TITLES[type]} <span className='font-normal text-tertiary'>({rows.length})</span>
          </h3>
          <ul className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {rows.map((row) => (
              <TokenCard key={row.key} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
