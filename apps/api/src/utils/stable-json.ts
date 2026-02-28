export function stableStringify(value: unknown): string {
  return stringifyValue(value);
}

function stringifyValue(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyValue(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const payload = entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stringifyValue(entryValue)}`)
    .join(',');

  return `{${payload}}`;
}
