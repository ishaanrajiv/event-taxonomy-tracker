export const normalizeName = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')

export const toSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
