# ReYohoho Aggregator for Lampa

Standalone Lampa plugin focused on ReYohoho-based online playback.

## Main Files

- `reyohoho.js` - primary public plugin file for Lampa
- `lordfilm.js` - compatibility alias with the same bundled output
- `src/providers/reyohoho.js` - ReYohoho provider logic (`KinoBD` and `Kinobox`)
- `proxy/worker.js` - Cloudflare Worker proxy for iframe, API, and stream hosts
- `docs/REYOHOHO_SETUP.md` - quick install and validation notes

## Features

- `ReYohoho+` button in Lampa movie cards
- `ReYohoho Aggregator` component and manifest identity
- ReYohoho provider with live `KinoBD`/`Kinobox` integration
- filtered provider output to skip obvious trailer and pseudo-source entries
- Worker allowlist updated for current ReYohoho/KinoBD iframe and media hosts

## Install In Lampa

Use one of these URLs after publishing:

- jsDelivr: `https://cdn.jsdelivr.net/gh/iwalker2005/reyohoho-lampa-plugin@main/reyohoho.js`
- raw GitHub: `https://raw.githubusercontent.com/iwalker2005/reyohoho-lampa-plugin/main/reyohoho.js`

Then open `Lampa -> Settings -> Extensions -> Add plugin by URL` and paste the plugin URL.

## Local Build

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-plugin.ps1
```

## Validation

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1 -CheckOnly
node --check src\providers\reyohoho.js
node --check src\index.js
node --check reyohoho.js
node --check proxy\worker.js
```
