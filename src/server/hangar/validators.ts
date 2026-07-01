export function enumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  if (allowed.includes(value as T)) return value as T;
  throw new Error(`Invalid ${label} from hangar DB: ${value}`);
}

export function numberOrNull(value: string | number | null) {
  if (value === null) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length ? strings : undefined;
}

export function postgresTextArray(value: unknown, label: string): string[] {
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

export function objectArray<T>(
  value: unknown,
  predicate: (row: unknown) => row is T,
): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(predicate);
}
