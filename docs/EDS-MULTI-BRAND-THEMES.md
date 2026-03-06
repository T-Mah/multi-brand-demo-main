# EDS Support for Multiple Brand Styles and Themes

Abbvie EDS delivery repo (`abbvie-nextgen-eds`) that includes one or more brand-specific sub-repos via Git submodules (`abbvie-nextgen-eds-themes` or one per brand).

You still have:

- One EDS code repo per site (or per cluster of sites).
- Separate brand repos that are pulled in as submodules and wired into `styles/`, `blocks/` or wherever you want your brand code to live.
- AEM Universal Editor (Crosswalk) with repoless to map multiple AEM sites to the same codebase, with theming driven via metadata.

---

## 0. Preconditions / Assumptions

Before doing Option A, you should have:

### Base EDS repo (`abbvie-nextgen-eds` - delivery repo)

- **Example:** `github.com/abbvie/abbvie-nextgen-eds`
- Contains at least:
  - `blocks/`
  - `scripts/`
  - `styles/`
  - `head.html`
  - ...

### Brand style repos

**Example for two brands:**

- `github.com/abbvie/humira-theme`
- `github.com/abbvie/rinvoq-theme`
- `github.com/abbvie/corporate-theme`

Each might look like:

```
styles/
  brand.css       # or tokens.css + brand.css, etc (!Important - no code/blocks)
```

### Edge Delivery site(s)

Configured in Cloud Manager pointing at eds-base, and repoless enabled.

---

## 1. Add brand repos as Git submodules in the base EDS repo

From a local clone of eds-base:

```bash
git clone git@github.com:abbvie/abbvie-nextgen-eds.git
cd eds-base

# For each brand:
git submodule add git@github.com:abbvie/humira-theme.git vendor/humira-theme
git submodule add git@github.com:abbvie/rinvoq-theme.git vendor/rinvoq-theme
# ...
```

You'll now have:

```
eds-base/
  vendor/
    humira-theme/   # submodule
      styles/
    rinvoq-theme/   # submodule
      styles/
```

Commit the submodule config:

```bash
git add .gitmodules vendor/
git commit -m "Add humira-theme and rinvoq-theme as Git submodules"
git push origin main
```

**Important:** Every developer and any CI step must use `git submodule update --init --recursive` when checking out this repo.

---

## 2. Wire submodule CSS into the styles/ folder

**The goal:** after build (or even just after submodule update), you want:

```
styles/
  styles.css
  humira-theme.css
  rinvoq-theme.css
  tokens.css    # optional
```

### 2.1 Decide your layout strategy

Typical pattern:

- Keep block-agnostic tokens / global styles in `styles/styles.css`.
- Copy/rename brand CSS from submodules into `styles/{brand}-*.css`.

**Example:** each brand repo has `styles/theme.css`:

- `vendor/humira-theme/styles/theme.css` → `styles/humira-theme.css`
- `vendor/rinvoq-theme/styles/theme.css` → `styles/rinvoq-theme.css`

### 2.2 Add a small build step to copy brand CSS

Create `scripts/sync-brand-styles.mjs` in eds-base:

```javascript
// scripts/sync-brand-styles.mjs
import { copyFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const brands = [
  { name: 'humira-theme', src: 'vendor/humira-theme/styles/theme.css' },
  { name: 'rinvoq-theme',  src: 'vendor/rinvoq-theme/styles/theme.css' },
];

const stylesDir = resolve('styles');
mkdirSync(stylesDir, { recursive: true });

brands.forEach((brand) => {
  const src = resolve(brand.src);
  const dest = resolve(stylesDir, `${brand.name}.css`);
  copyFileSync(src, dest);
  console.log(`Synced ${src} → ${dest}`);
});
```

Update `package.json`:

```json
{
  "scripts": {
    "sync:brands": "node ./scripts/sync-brand-styles.mjs",
    "build": "npm run sync:brands && <your-existing-build-script>"
  }
}
```

Now any local build or CI build can run:

```bash
npm run sync:brands
```

and your `styles/` folder will contain brand CSS copied from submodules.

---

## 3. Implement theme selection in JS + CSS

You want each brand site to automatically load its own theme.

### 3.1 Decide how you identify the brand

The cleanest is via metadata (per site) applied in AEM / repoless, so pages render:

```html
<meta name="theme" content="humira-theme">
```

Alternatively, you can add `class="theme-brand-alpha"` on `<body>`. This guide uses the meta approach.

### 3.2 Theme CSS structure

In `styles/styles.css`:

```css
:root {
  --color-primary: #0044cc;
  --font-heading: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

/* blocks use tokens, not brand colors directly */
.block-cta {
  background-color: var(--color-primary);
  font-family: var(--font-heading);
}
```

In each brand CSS file (provided by submodules, but they should follow this convention):

```css
/* styles/humira-theme.css */
body.theme-humira-theme {
  --color-primary: #D2232A;
  --font-heading: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

/* styles/brand-beta.css */
body.theme-rinvoq-theme {
  --color-primary: #009A44;
  --font-heading: "IBM Plex Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

### 3.3 Theme loader JS

Add `scripts/theme.js`:

```javascript
export function applyTheme() {
  const meta = document.querySelector('meta[name="theme"]');
  const theme = meta?.content;
  if (!theme) return;

  // normalize, e.g. "humira-theme"
  const themeId = theme.trim();

  // apply body class for CSS variable scoping
  document.body.classList.add(`theme-${themeId}`);

  // load theme stylesheet
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/styles/${themeId}.css`; // e.g. /styles/humira-theme.css
  document.head.appendChild(link);
}
```

In your main bootstrap (`scripts/scripts.js` or `aem.js`):

```javascript
import { applyTheme } from './theme.js';

window.addEventListener('load', () => {
  applyTheme();
  // ... other init logic
});
```

Commit:

```bash
git add scripts/theme.js styles/ scripts/sync-brand-styles.mjs package.json
git commit -m "Wire brand submodule styles and dynamic theme loading"
git push origin main
```

---

## 4. Configure brand sites in Cloud Manager (EDS) using same base repo

For each brand you want as a separate EDS site (with its own URLs and CDN mapping), do:

1. In **Cloud Manager → Edge Delivery → Edge Delivery Sites:**
   - Click **Add Edge Delivery site**.
   - For existing code project:
     - **Site name:** `humira-theme`
     - **Repository URL:** `https://github.com/abbvie/abbvie-nextgen-eds`

**Result:** you now have EDS sites like:

- `https://main--humira-theme--abbvie.aem.page`
- `https://main--rinvoq-theme--abbvie.aem.page`

Both use the same base repo (`abbvie-nextgen-eds`) but can be mapped to different content and theming via repoless + metadata.

---

## 5. Create AEM sites for each brand (Universal Editor) using Crosswalk

For each brand:

1. In **AEM as a Cloud Service:**
   - Go to **Sites → Create → Site from template**.
   - Choose your Crosswalk / EDS site template.
   - Fill in:
     - **Title:** Humira
     - **Name:** Humira
     - **GitHub URL:** `https://github.com/abbvie/abbvie-nextgen-eds` (same base repo)
   - Finish the wizard.

You now have:

- `/content/humira-theme`
- `/content/rinvoq-theme`
- etc., as separate site roots, all tied to the same EDS codebase.

---

## 6. Configure repoless mapping for each brand

Use the config service (Helix 5) to map AEM content paths to EDS sites.

### 6.1 Define mappings in config service

In your org's Edge config (via admin.hlx.page / config JSON):

**Example conceptual structure:**

```json
{
  "mappings": [
    {
      "aem": "/content/humira-theme/",
      "site": "humira",
      "public": "/"
    },
    {
      "aem": "/content/rinvoq-theme/",
      "site": "rinvoq",
      "public": "/"
    }
  ],
  "includes": [
    "/content/humira-theme/",
    "/content/rinvoq-theme/"
  ]
}
```

### 6.2 Edge Delivery Services Configuration in AEM

For each site root:

1. Go to **Tools → Cloud Services → Edge Delivery Services Configuration**.
2. Create or edit the configuration for Humira:
   - **Organization:** Abbvie.
   - **Site name:** Humira (exact EDS site id).
   - **Project type:** aem.live with repoless config setup.
3. Save & Close.

Repeat for `rinvoq-theme`, etc.

---

## 7. Emit the correct theme per brand/site

You need pages under `/content/humira-theme` to carry:

```html
<meta name="theme" content="humira-theme">
```

So `applyTheme()` will pick `brand-alpha.css` from the submodule.

There are several ways to do this.

### 7.1 MSM / inherited properties

If you use AEM MSM for multi-language / multi-region:

- Add `theme=humira-theme` as a property at the `humira-theme` site root.
- Ensure your HTML rendering reads that property and outputs `<meta name="theme"...>` for all descendant pages.

**The net effect:** every page of rinvoq-theme yields `theme="humira-theme"`; Brand Beta yields `theme="rinvoq-theme"`.

---

## 8. CI & local dev: make submodules & sync robust

To keep this stable:

### Document submodule init

```bash
git clone git@github.com:abbvie/abbvie-nextgen-eds.git
cd eds-base
git submodule update --init --recursive
npm install
npm run sync:brands
```

### In CI (GitHub Actions, etc.)

```yaml
- name: Checkout
  uses: actions/checkout@v4
  with:
    submodules: recursive

- name: Install
  run: npm ci

- name: Sync brand styles
  run: npm run sync:brands

- name: Build
  run: npm run build
```

### Submodule updates

Ensure your EDS outer CDN invalidation is still tied to `main` of eds-base. Updates in brand repos only become live when you:

1. Update the submodule reference in eds-base:

```bash
cd vendor/humira-theme
git pull origin main   # or a tag/branch
cd ../..
git add vendor/rinvoq-theme
git commit -m "Update humira-theme submodule to latest"
git push origin main
```

---

## 9. End-to-end validation checklist for a new brand

For each new branded site using submodules:

| Area | Check |
|------|-------|
| **Brand repo** | Has `styles/theme.css` scoped to `.theme-brand-<id>` or variables. |
| **EDS base repo** | Submodule added under `vendor/<brand>/`. |
| | `scripts/sync-brand-styles.mjs` copies `theme.css` to `styles/<brand>.css`. |
| | `applyTheme()` loads `/styles/<brand>.css` and adds body class. |
| **Edge Delivery (Cloud Manager)** | New site created (`brand-id`) pointing to eds-base repo. |
| **AEM (Crosswalk)** | Site created from template (`/content/<brand-id>`). |
| | Edge Delivery Services config set to project type = aem.live with repoless and site name set. |
| **Config service (repoless)** | Mapping from `/content/<brand-id>/` → site `brand-id`. |
| **Theme metadata** | Pages under `/content/<brand-id>/` emit `<meta name="theme" content="<brand-id>">`. |
| **Authoring** | UE editing works for `/content/<brand-id>/...` pages. |
| **EDS preview/live** | `https://main--<brand-id>--your-org.aem.page` shows correct branding. |
| | Publishing in UE updates EDS site as expected. |
