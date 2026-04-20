# ReYohoho Aggregator Setup

## Main Release File

- Primary plugin file: `C:\Users\oleg\Downloads\lampa-plugin\reyohoho.js`
- Compatibility alias: `C:\Users\oleg\Downloads\lampa-plugin\lordfilm.js`

## What Is Included

- `ReYohoho` provider with `KinoBD` and `Kinobox` integration
- filtered live providers so obvious junk entries are skipped:
  - `youtube`
  - `trailer`
  - `trailer_local`
  - `netflix`
  - `torrent`
  - `nf`
- updated Cloudflare Worker allowlist for current iframe/embed/media hosts

## Lampa Install

1. Open `Lampa`.
2. Go to `Settings -> Extensions -> Add plugin by URL`.
3. Point it to your published `reyohoho.js`.
4. Restart `Lampa` completely.
5. Open any movie card and use the `ReYohoho+` button.

## Live Notes

As of April 18, 2026, the most stable live `KinoBD` keys we confirmed were:

- `turbo`
- `collaps`
- `kinotochka`
- `vibix`
- `ashdi`
- `flixcdn`

Secondary and less predictable:

- `hdvb`
- `netflix`
- `torrent`

The plugin now skips the clearly non-useful trailer and pseudo-source variants.

## Rebuild

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-plugin.ps1
```

## Sync Check

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1 -CheckOnly
```

## Syntax Checks

```powershell
node --check src\providers\reyohoho.js
node --check src\index.js
node --check reyohoho.js
node --check proxy\worker.js
```
