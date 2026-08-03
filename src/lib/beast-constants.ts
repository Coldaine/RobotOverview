export const BEAST_COCKPIT_WS_URL_DEFAULT = 'wss://beast-01.tyrannosaurus-magellanic.ts.net/';

export function resolveBeastCockpitWsUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.BEAST_COCKPIT_WS_URL?.trim() || BEAST_COCKPIT_WS_URL_DEFAULT;
}
