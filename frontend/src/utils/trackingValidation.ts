import { Event, Property } from '../types/api';

export type ValidationStatus = 'pass' | 'warning';

export interface TrackingValidationCheck {
  id: string;
  title: string;
  status: ValidationStatus;
  summary: string;
  items: string[];
}

export interface TrackingValidationSummary {
  checks: TrackingValidationCheck[];
  warningChecks: number;
  warningItems: number;
  passChecks: number;
}

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ');

const normalizePropertyName = (value: string): string => {
    const withSpaces = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .toLowerCase();
  return withSpaces.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '').trim();
};

const toTitleCaseWord = (word: string): boolean => {
  if (!word) return false;
  if (/^[A-Z0-9]{2,}$/.test(word)) return true;
  return /^[A-Z][a-z0-9]*$/.test(word);
};

const isTitleCaseName = (name: string): boolean => {
  const cleaned = normalizeWhitespace(name);
  if (!cleaned) return false;

  return cleaned.split(' ').every((part) => {
    const word = part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    return toTitleCaseWord(word);
  });
};

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = temp;
    }
  }

  return prev[b.length];
};

const pluralize = (count: number, singular: string, plural?: string): string => {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural ?? `${singular}s`}`;
};

const buildCheck = (
  id: string,
  title: string,
  items: string[],
  passingSummary: string,
  failingSummary: (count: number) => string
): TrackingValidationCheck => {
  if (items.length === 0) {
    return {
      id,
      title,
      status: 'pass',
      summary: passingSummary,
      items: [],
    };
  }

  return {
    id,
    title,
    status: 'warning',
    summary: failingSummary(items.length),
    items,
  };
};

export const buildTrackingValidationSummary = (
  events: Event[],
  properties: Property[]
): TrackingValidationSummary => {
  const conflictingPropertyTypes: string[] = [];
  const propertyTypeMap = new Map<string, Set<string>>();

  for (const property of properties) {
    const key = normalizeWhitespace(property.name).toLowerCase();
    const type = normalizeWhitespace(property.data_type || '');
    if (!propertyTypeMap.has(key)) {
      propertyTypeMap.set(key, new Set());
    }
    if (type) {
      propertyTypeMap.get(key)?.add(type);
    }
  }

  for (const event of events) {
    for (const prop of event.properties || []) {
      const key = normalizeWhitespace(prop.property_name).toLowerCase();
      const type = normalizeWhitespace(prop.data_type || '');
      if (!propertyTypeMap.has(key)) {
        propertyTypeMap.set(key, new Set());
      }
      if (type) {
        propertyTypeMap.get(key)?.add(type);
      }
    }
  }

  for (const [name, dataTypes] of propertyTypeMap.entries()) {
    if (dataTypes.size > 1) {
      conflictingPropertyTypes.push(`${name}: ${Array.from(dataTypes).join(', ')}`);
    }
  }

  const duplicateEventNames: string[] = [];
  const eventNameCounts = new Map<string, number>();
  const eventNameDisplay = new Map<string, string>();

  for (const event of events) {
    const normalized = normalizeWhitespace(event.name).toLowerCase();
    if (!normalized) continue;
    eventNameCounts.set(normalized, (eventNameCounts.get(normalized) || 0) + 1);
    if (!eventNameDisplay.has(normalized)) {
      eventNameDisplay.set(normalized, normalizeWhitespace(event.name));
    }
  }

  for (const [name, count] of eventNameCounts.entries()) {
    if (count > 1) {
      duplicateEventNames.push(`${eventNameDisplay.get(name) || name} (${pluralize(count, 'event')})`);
    }
  }

  const nonTitleCaseEventNames = events
    .filter((event) => !isTitleCaseName(event.name || ''))
    .map((event) => normalizeWhitespace(event.name || '(unnamed event)'));

  const propertyNames = Array.from(
    new Set(
      [
        ...properties.map((property) => normalizeWhitespace(property.name)),
        ...events.flatMap((event) => (event.properties || []).map((prop) => normalizeWhitespace(prop.property_name))),
      ].filter((name) => name.length > 0)
    )
  );

  const similarPropertyPairs: string[] = [];
  for (let i = 0; i < propertyNames.length; i += 1) {
    for (let j = i + 1; j < propertyNames.length; j += 1) {
      const left = propertyNames[i];
      const right = propertyNames[j];
      const leftCanonical = normalizePropertyName(left);
      const rightCanonical = normalizePropertyName(right);
      if (!leftCanonical || !rightCanonical || left.toLowerCase() === right.toLowerCase()) {
        continue;
      }

      const exactCanonicalMatch = leftCanonical === rightCanonical;
      const fuzzyMatch =
        leftCanonical.length >= 5 &&
        rightCanonical.length >= 5 &&
        leftCanonical.slice(0, 3) === rightCanonical.slice(0, 3) &&
        Math.abs(leftCanonical.length - rightCanonical.length) <= 2 &&
        levenshteinDistance(leftCanonical, rightCanonical) <= 1;

      if (exactCanonicalMatch || fuzzyMatch) {
        similarPropertyPairs.push(`${left} <-> ${right}`);
      }
    }
  }

  const missingPropertyTypes = [
    ...properties
      .filter((property) => !normalizeWhitespace(property.data_type || ''))
      .map((property) => property.name),
    ...events.flatMap((event) =>
      (event.properties || [])
        .filter((prop) => !normalizeWhitespace(prop.data_type || ''))
        .map((prop) => `${event.name} > ${prop.property_name}`)
    ),
  ];

  const eventsMissingDescription = events
    .filter((event) => !normalizeWhitespace(event.description || ''))
    .map((event) => normalizeWhitespace(event.name || '(unnamed event)'));

  const checks: TrackingValidationCheck[] = [
    buildCheck(
      'conflicting-property-types',
      'No conflicting property data types',
      conflictingPropertyTypes,
      'No conflicting property data types',
      (count) => `${pluralize(count, 'property')} have conflicting data types`
    ),
    buildCheck(
      'unique-event-names',
      'All events have unique names',
      duplicateEventNames,
      'All events have unique names',
      (count) => `${pluralize(count, 'event name')} are duplicated`
    ),
    buildCheck(
      'event-title-case',
      'All event names are in Title Case',
      nonTitleCaseEventNames,
      'All event names are in Title Case',
      (count) => `${pluralize(count, 'event name')} are not in Title Case`
    ),
    buildCheck(
      'similar-property-names',
      'No similar property names',
      similarPropertyPairs,
      'No similar property names',
      (count) => `${pluralize(count, 'property pair')} have same or similar names`
    ),
    buildCheck(
      'property-types-defined',
      'All properties have defined type',
      missingPropertyTypes,
      'All properties have defined type',
      (count) => `${pluralize(count, 'property')} do not have a defined type`
    ),
    buildCheck(
      'event-description',
      'All events have a description',
      eventsMissingDescription,
      'All events have a description',
      (count) => `${pluralize(count, 'event')} do not have a description`
    ),
  ];

  const warningChecks = checks.filter((check) => check.status === 'warning').length;
  const warningItems = checks
    .filter((check) => check.status === 'warning')
    .reduce((total, check) => total + check.items.length, 0);

  return {
    checks,
    warningChecks,
    warningItems,
    passChecks: checks.length - warningChecks,
  };
};
