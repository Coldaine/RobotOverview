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
