#!/usr/bin/env node
/**
 * Syncs brand theme CSS from vendor submodules into styles/
 * Runs automatically via postinstall. Required because EDS dev server
 * may not serve the vendor/ path directly.
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const brands = [
  { name: 'brand-alpha-1', src: 'vendor/brand-alpha-1/styles/theme.css' },
];

const stylesDir = resolve(rootDir, 'styles');
mkdirSync(stylesDir, { recursive: true });

brands.forEach((brand) => {
  const src = resolve(rootDir, brand.src);
  const dest = resolve(stylesDir, `${brand.name}.css`);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`Synced ${brand.src} → styles/${brand.name}.css`);
  } else {
    console.warn(`Warning: ${src} not found, skipping ${brand.name}`);
  }
});
