import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = readdirSync(new URL('../tests/', import.meta.url)).filter(name => name.endsWith('.test.js')).sort().map(name => new URL(`../tests/${name}`, import.meta.url));
const { fileURLToPath } = await import('node:url');
const result = spawnSync(process.execPath, ['--test', ...files.map(fileURLToPath)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
