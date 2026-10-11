import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import { generateIcons } from './icons.mjs';

await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await generateIcons('dist');
await build({
  entryPoints: ['src/background.ts', 'src/content.ts', 'src/dashboard.ts', 'src/popup.ts', 'src/page.ts'],
  outdir: 'dist', bundle: true, format: 'iife', target: 'chrome120',
  sourcemap: false,
});
console.log('Built Still Harbor → dist/');
