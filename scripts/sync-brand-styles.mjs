#!/usr/bin/env node
/**
 * Syncs brand theme CSS from vendor submodules into styles/
 * Run: npm run sync:brands
 */
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
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
  // Sync theme CSS
  const src = resolve(rootDir, brand.src);
  const dest = resolve(stylesDir, `${brand.name}.css`);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`Synced ${brand.src} → styles/${brand.name}.css`);
  } else {
    console.warn(`Warning: ${src} not found, skipping ${brand.name}`);
  }

  // Sync brand icons to icons/brand-name/
  const iconsSrc = resolve(rootDir, `vendor/${brand.name}/icons`);
  const iconsDest = resolve(rootDir, 'icons', brand.name);
  if (existsSync(iconsSrc)) {
    mkdirSync(iconsDest, { recursive: true });
    readdirSync(iconsSrc).forEach((file) => {
      if (file.endsWith('.svg') || file.endsWith('.png') || file.endsWith('.webp')) {
        copyFileSync(resolve(iconsSrc, file), resolve(iconsDest, file));
        console.log(`Synced vendor/${brand.name}/icons/${file} → icons/${brand.name}/${file}`);
      }
    });
  }
});
