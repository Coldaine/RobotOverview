import { spawnSync } from 'node:child_process';
import process from 'node:process';

const disabled = process.env.HANGAR_SKIP_BOOTSTRAP === '1';
const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isWindows = process.platform === 'win32';

if (disabled || isCi || !isWindows) {
  process.exit(0);
}

const result = spawnSync(
  'pwsh',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    'bootstrap/install-tools.ps1',
    '-SkipProjectDependencies',
  ],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  },
);

if (result.error) {
  console.warn(`[bootstrap] Tool bootstrap skipped: ${result.error.message}`);
  process.exit(0);
}

if (result.status !== 0) {
  console.warn('[bootstrap] Tool bootstrap did not complete. Run `npm run bootstrap:tools` manually.');
}
