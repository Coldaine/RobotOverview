export function enumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  if (allowed.includes(value as T)) return value as T;
  throw new Error(`Invalid ${label} from hangar DB: ${value}`);
}

export function numberOrNull(value: string | number | null, label = 'numeric value') {
  if (value === null) return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(number)) return number;
  throw new Error(`Invalid ${label} from hangar DB: ${value}`);
}

export function nonNegativeNumberOrNull(value: string | number | null, label = 'numeric value') {
  const number = numberOrNull(value, label);
  if (number === null || number >= 0) return number;
  throw new Error(`Invalid ${label} from hangar DB: expected a non-negative number, got ${value}.`);
}

export function positiveIntegerOrNull(value: string | number | null, label = 'integer value') {
  const number = numberOrNull(value, label);
  if (number === null || (Number.isInteger(number) && number > 0)) return number;
  throw new Error(`Invalid ${label} from hangar DB: expected a positive integer, got ${value}.`);
}

export function postgresTextArray(value: unknown, label: string): string[] {
  if (value === null) return [];

  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label} from hangar DB: expected text array.`);
  }

  const invalidIndex = value.findIndex((item) => typeof item !== 'string');
  if (invalidIndex !== -1) {
    throw new Error(
      `Invalid ${label} from hangar DB: expected text at index ${invalidIndex}.`,
    );
  }

  return value;
}

export function isTrimmedNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value === value.trim();
}

export function isTrimmedHttpUrl(value: unknown): value is string {
  if (!isTrimmedNonBlankString(value)) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const ISO_DATE_OR_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

function hasValidIsoDateParts(value: string): boolean {
  const match = ISO_DATE_OR_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === Number(day)
  );
}

export function isTrimmedTimestamp(value: unknown): value is string {
  return (
    isTrimmedNonBlankString(value) &&
    hasValidIsoDateParts(value) &&
    Number.isFinite(new Date(value).getTime())
  );
}

export function postgresNonBlankTextArray(value: unknown, label: string): string[] {
  const text = postgresTextArray(value, label);
  const invalidIndex = text.findIndex((item) => !isTrimmedNonBlankString(item));
  if (invalidIndex !== -1) {
    throw new Error(
      `Invalid ${label} from hangar DB: expected non-blank trimmed text at index ${invalidIndex}.`,
    );
  }

  return text;
}

export function strictObjectArray<T>(
  value: unknown,
  label: string,
  predicate: (row: unknown) => row is T,
): T[] {
  if (value === null) return [];

  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label} from hangar DB: expected object array.`);
  }

  const invalidIndex = value.findIndex((row) => !predicate(row));
  if (invalidIndex !== -1) {
    throw new Error(
      `Invalid ${label} from hangar DB: expected valid object at index ${invalidIndex}.`,
    );
  }

  return value;
}
