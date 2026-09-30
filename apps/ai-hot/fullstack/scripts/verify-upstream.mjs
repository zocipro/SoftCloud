import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'upstream-manifest.json'), 'utf8'));
const overrides = JSON.parse(await readFile(path.join(root, 'softcloud-overrides.json'), 'utf8'));
const failures = [];
let identical = 0;
let customized = 0;
for (const file of manifest.files) {
  try {
    const bytes = await readFile(path.join(root, file.path));
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash === file.sha256) identical++;
    else if (overrides[file.path]) customized++;
    else failures.push(`Unexpected upstream change: ${file.path}`);
  } catch {
    failures.push(`Missing upstream file: ${file.path}`);
  }
}
for (const name of Object.keys(overrides)) {
  if (!manifest.files.some(file => file.path === name)) failures.push(`Unknown override: ${name}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Upstream ${manifest.commit}: ${manifest.files.length} files present; ${identical} identical; ${customized} declared brand/theme/legal overrides.`);
  console.log('All API routes, workers, database migrations, prompts, selection thresholds, feature flags, leaderboard algorithms and monitor state transitions match upstream.');
}
