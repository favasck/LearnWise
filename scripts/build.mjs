import { build } from 'vite';
import config from '../vite.config.js';

// Load the ESM config directly instead of bundling it through esbuild. This also
// works in restricted Windows checkouts whose parent directory is not listable.
await build({ ...config, configFile:false });
// Keep the prototype independent of authentication and production app chunks.
await build({ ...config, configFile:false, build:{emptyOutDir:false,rollupOptions:{input:'mobile-prototype.html'}} });
await import('./export-mobile-prototype.mjs');
