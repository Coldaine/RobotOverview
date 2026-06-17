/**
 * Whether a nav station is "active" for the current route.
 * - `end`: exact match only (used by the hub "/" so it isn't active everywhere)
 * - otherwise: exact match, a path segment under `href`, or any `activePrefixes`
 *   match (e.g. /missions stays active on /mission/[id]).
 */
export function isNavActive(
  pathname: string,
  href: string,
  opts?: { end?: boolean; activePrefixes?: readonly string[] },
): boolean {
  const { end = false, activePrefixes = [] } = opts ?? {};
  if (end) return pathname === href;
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    activePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}
