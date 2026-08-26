# Infrastructure

## Preview routing
- Caddy reverse_proxy `/` → port 3000 (Node/Next.js standalone `npm run start`).

## Background service (production)
- `vedaai-web`: `npm run start` (serves `.next` build), working dir `/workspace`.
- Build happens in setup script (`npm ci && npm run build`) — never `next dev` in the service.

## Env keys (backend-managed)
File `/workspace/.env`:
| Key | Tag | Notes |
|---|---|---|
| OPENAI_API_KEY | static (minted) | secret |
| OPENAI_BASE_URL | static (minted) | gateway base URL |
| AI_MODEL | static | vision-capable model id |
| AI_VISION_MODEL | static | same unless overridden |
| NODE_ENV | app_env | |
| NEXT_TELEMETRY_DISABLED | static `1` | |
| PORT | static `3000` | |
| MAX_DOC_MB | static `10` | per document upload cap |

## Ports
- App: 3000 (only port; Caddy proxies to it).

## Setup script (runs on every deploy)
```
npm ci
npm run build
```
No migrations (no DB). Health: `/api/health`.

## Temp storage
- `os.tmpdir()/vedaai/{jobId}/` — uploads + rasterized pages; TTL sweep removes after 60 min.
