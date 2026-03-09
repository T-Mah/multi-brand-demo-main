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

### 2.2 Load theme CSS directly from vendor

Theme CSS is loaded at runtime from `vendor/{theme}/styles/theme.css`. No build or sync step is required. The theme loader (see section 3.3) uses this path when theme metadata is present.

**Brand icons:** Blocks needing theme-specific icons can reference `/vendor/{theme}/icons/{name}.svg` (e.g. `/vendor/brand-alpha-1/icons/logo.svg`). The default `decorateIcon()` from aem.js loads from `/icons/` and cannot be overridden.

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
git add scripts/theme.js styles/ package.json
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
```

Theme CSS loads directly from `vendor/{theme}/styles/theme.css` at runtime. No sync step required.

### In CI (GitHub Actions, etc.)

```yaml
- name: Checkout
  uses: actions/checkout@v4
  with:
    submodules: recursive

- name: Install
  run: npm ci

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
| | Theme loads from `vendor/<brand>/styles/theme.css` at runtime. |
| | `applyTheme()` or theme loader adds body class and loads theme CSS. |
| **Edge Delivery (Cloud Manager)** | New site created (`brand-id`) pointing to eds-base repo. |
| **AEM (Crosswalk)** | Site created from template (`/content/<brand-id>`). |
| | Edge Delivery Services config set to project type = aem.live with repoless and site name set. |
| **Config service (repoless)** | Mapping from `/content/<brand-id>/` → site `brand-id`. |
| **Theme metadata** | Pages under `/content/<brand-id>/` emit `<meta name="theme" content="<brand-id>">`. |
| **Authoring** | UE editing works for `/content/<brand-id>/...` pages. |
| **EDS preview/live** | `https://main--<brand-id>--your-org.aem.page` shows correct branding. |
| | Publishing in UE updates EDS site as expected. |

---

## Appendix A: Git Workflow

This section documents the Git steps for the main repo, submodules, and how to make and commit changes in each.

### Repository structure

| Repo | Path | Purpose |
|------|------|---------|
| **Main (EDS base)** | Project root | Blocks, scripts, shared styles, theme loader, submodule references |
| **Submodule (brand)** | `vendor/brand-alpha-1/` | Brand-specific styles, theme CSS, icons |

The main repo stores a **pointer** (commit hash) to the submodule. It does not store the submodule's files directly.

---

### Initial clone (new developer)

```bash
# Clone the main repo
git clone https://github.com/your-org/multi-brand-demo.git
cd multi-brand-demo

# Initialize and fetch submodules (required!)
git submodule update --init --recursive

# Install dependencies
npm install
```

Theme CSS loads directly from the vendor submodule at runtime. No sync step required.

---

### Making changes to the submodule (brand-alpha-1)

When you edit files in `vendor/brand-alpha-1/` (e.g. `styles/theme.css`, `icons/`):

```bash
# 1. Navigate into the submodule
cd vendor/brand-alpha-1

# 2. Check status
git status

# 3. Stage your changes
git add styles/theme.css icons/search.svg icons/logo.svg
# or: git add .

# 4. Commit in the submodule
git commit -m "Add orange theme and brand assets"

# 5. Push to the brand repo
git push origin main

# 6. Go back to main repo and update the submodule pointer
cd ../..
git add vendor/brand-alpha-1
git commit -m "Update brand-alpha-1 submodule to latest"
git push origin main
```

**Important:** You must commit and push in the submodule first, then commit the updated pointer in the main repo. Both repos need to be pushed for changes to be fully saved.

---

### Making changes to the main repo

When you edit files in the main project (e.g. `scripts/`, `blocks/`, `head.html`, `styles/styles.css`):

```bash
# 1. Ensure you're in the main repo root (not inside vendor/)
cd /path/to/multi-brand-demo-main

# 2. Check status (submodule may show as modified if its pointer changed)
git status

# 3. Stage your changes
git add scripts/scripts.js head.html
# or: git add .

# 4. Commit
git commit -m "Add theme loader and wire brand-alpha-1 theme"

# 5. Push
git push origin main
```

**Note:** If you only changed files in the main repo (not in the submodule), you do not need to touch the submodule. If you also updated the submodule, follow the submodule workflow above and include `vendor/brand-alpha-1` in your main repo commit.

---

### Pulling latest changes

**Main repo only:**

```bash
git pull origin main
git submodule update --init --recursive
npm install
```

**When the brand repo has new commits** (e.g. brand team pushed changes):

```bash
cd vendor/brand-alpha-1
git pull origin main
cd ../..
git add vendor/brand-alpha-1
git commit -m "Update brand-alpha-1 submodule to latest"
git push origin main
```

---

### Quick reference

| Task | Commands |
|------|----------|
| **Edit submodule** | `cd vendor/brand-alpha-1` → edit → `git add` → `git commit` → `git push` |
| **Update main to point at new submodule commit** | `cd ../..` → `git add vendor/brand-alpha-1` → `git commit` → `git push` |
| **Edit main repo** | Edit at root → `git add` → `git commit` → `git push` |
| **After any clone/pull** | `git submodule update --init --recursive` then `npm install` |

---

## Appendix B: End-to-End Process

### Making changes to an existing brand (e.g. brand-alpha-1)

| Step | Who | Action |
|------|-----|--------|
| 1 | Brand team | Clone brand repo: `git clone https://github.com/T-Mah/brand-alpha-1.git` |
| 2 | Brand team | Edit `styles/theme.css`, `icons/`, etc. |
| 3 | Brand team | Commit and push: `git add .` → `git commit -m "..."` → `git push origin main` |
| 4 | Platform team | In main repo: `cd vendor/brand-alpha-1` → `git pull origin main` |
| 5 | Platform team | `cd ../..` → `git add vendor/brand-alpha-1` → `git commit -m "Update brand-alpha-1 submodule"` → `git push origin main` |

Theme CSS loads from `vendor/brand-alpha-1/styles/theme.css` at runtime. No sync step required.

---

### Adding a new brand (e.g. brand-beta-2)

| Step | Who | Action |
|------|-----|--------|
| 1 | Brand team | Create brand repo with `styles/theme.css` (and optional `icons/`) |
| 2 | Platform team | Add submodule: `git submodule add https://github.com/org/brand-beta-2.git vendor/brand-beta-2` |
| 3 | Platform team | Commit: `git add .gitmodules vendor/` → `git commit -m "Add brand-beta-2 submodule"` → `git push` |
| 4 | AEM / config | Set theme metadata for the new site: `<meta name="theme" content="brand-beta-2">` |

No changes to `scripts.js` are required. The theme loader uses `vendor/${theme}/styles/theme.css` dynamically.

---

### Brand repo structure (required)

Each brand repo must have:

```
brand-xyz/
  styles/
    theme.css    # Required – CSS overrides scoped to body.brand-xyz
  icons/         # Optional – logo.svg, search.svg, etc.
```

The `theme.css` file should scope overrides to the body class matching the theme name (e.g. `body.brand-beta-2`).

---

### Troubleshooting: index.lock error

If you see:

```
fatal: Unable to create '.../index.lock': File exists.
Another git process seems to be running...
```

1. Close other Git processes (IDE, terminals, Git GUI).
2. Remove the lock file manually:

   **PowerShell:**
   ```powershell
   Remove-Item ".git\modules\vendor\brand-alpha-1\index.lock" -Force
   ```

   **Bash:**
   ```bash
   rm .git/modules/vendor/brand-alpha-1/index.lock
   ```

3. Retry your `git add` or `git commit`.
