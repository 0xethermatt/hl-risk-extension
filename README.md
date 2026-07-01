# Hyperliquid Risk Manager

A private Chrome extension (Manifest V3) for risk management and position
sizing on [Hyperliquid](https://app.hyperliquid.xyz).

## Tech stack

- [Vite](https://vitejs.dev/) + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) for MV3 bundling and HMR
- [React 19](https://react.dev/) + TypeScript (strict mode)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Vitest](https://vitest.dev/) + Testing Library for unit/component tests

## Project structure

```
manifest.json           Chrome extension manifest (MV3)
public/icons/            Extension icons
src/
  background/            Service worker
  content/                Content script injected into app.hyperliquid.xyz
  popup/                  Toolbar popup UI (React app)
  options/                Extension options/settings page (React app)
  components/             Shared React components
  lib/                    Framework-agnostic logic (position sizing, storage helpers)
  types/                  Shared TypeScript types
  styles/                 Tailwind entry stylesheet
  test/                   Test setup
```

## Local development

### Prerequisites

- Node.js 20+ and npm

### Install dependencies

```sh
npm install
```

### Run the dev server

```sh
npm run dev
```

This starts Vite in watch mode and writes an unpacked, HMR-enabled build to
`dist/`.

### Load the extension in Chrome

1. Run `npm run dev` (or `npm run build` for a production build).
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `dist/` directory.
5. The extension icon should appear in the toolbar. Changes made while
   `npm run dev` is running will hot-reload automatically.

### Other scripts

```sh
npm run build       # Type-check and produce a production build in dist/
npm run typecheck   # Type-check only, no emit
npm run lint         # Lint the codebase with ESLint
npm test             # Run the Vitest test suite once
npm run test:watch  # Run Vitest in watch mode
npm run preview      # Preview the production build
```

## Notes

- The content script currently targets `https://app.hyperliquid.xyz/*`.
- Extension settings (default/max risk percentage) are persisted with
  `chrome.storage.sync` via `src/lib/settingsStorage.ts`.
- This is a private project; do not publish the icons/branding without
  checking licensing.
