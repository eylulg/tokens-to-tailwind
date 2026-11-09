const files = import.meta.glob<string>(["./*.json", "./*.txt"], { query: "?raw", import: "default", eager: true });

/** Reads a fixture file as text. Test-only helper. */
export function fixture(name: string): string {
    const text = files[`./${name}`];
    if (text === undefined) throw new Error(`Unknown fixture ${name}`);
    return text;
}

export function fixtureJson(name: string): unknown {
    return JSON.parse(fixture(name));
}
