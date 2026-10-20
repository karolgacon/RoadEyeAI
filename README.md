# RoadEye AI

Monitorowanie stanu nawierzchni dróg w Polsce: **Leaflet + PostGIS (OSM)** → **Sentinel-2** → **Gemini Vision** → raport PCI z eksportem PDF/JSON.

## Stack (free-first)

| Warstwa | Wybór |
|--------|--------|
| App | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui |
| Mapa | Leaflet / OSM (+ Esri Imagery) |
| DB | Supabase Free (PostgreSQL + PostGIS) |
| Satelita | **Sentinel-2 LEO** przez Copernicus CDSE; bez kluczy → Esri preview |
| AI | Google Gemini Vision (mock bez klucza) |
| Deploy | Vercel Hobby |

## Setup lokalny

1. Skopiuj `.env.example` → `.env.local` i uzupełnij wartości.
2. W Supabase **SQL Editor** uruchom migracje:
   - [`supabase/migrations/001_init_postgis.sql`](supabase/migrations/001_init_postgis.sql)
   - [`supabase/migrations/002_roads_bbox_rpc.sql`](supabase/migrations/002_roads_bbox_rpc.sql)
3. Ustaw `DATABASE_URL` (Connect → URI; na Vercel preferuj **pooler**, port `6543`).
4. Start:

```bash
npm install
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Skrypty

```bash
npm run dev          # development
npm run build        # produkcja
npm test             # unit (node:test + tsx)
npm run lint
npm run db:migrate   # DDL przez DATABASE_URL
npm run import:roads # Overpass PL: A/S/DK + DW
```

Import Overpass: szczegóły w [`scripts/README-import.md`](scripts/README-import.md).  
`seed:roads` jest **przestarzały** (sztuczne korytarze) — nie używaj na mapie produkcyjnej.

## Deploy na Vercel Hobby

1. Repo na GitHub → [vercel.com/new](https://vercel.com/new) → import projektu.
2. Framework: **Next.js** (wykryty automatycznie; `vercel.json` ustawia region `fra1`).
3. Env (Production + Preview):

| Zmienna | Wymagane | Uwagi |
|---------|----------|--------|
| `DATABASE_URL` | tak | Supabase **Transaction/Session pooler** |
| `NEXT_PUBLIC_SUPABASE_URL` | tak | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | tak | |
| `SUPABASE_SECRET_KEY` | zalecane | Storage / admin |
| `GOOGLE_GENERATIVE_AI_API_KEY` | zalecane | bez klucza → mock AI |
| `COPERNICUS_CLIENT_ID` / `COPERNICUS_CLIENT_SECRET` | dla LEO | [dataspace.copernicus.eu](https://dataspace.copernicus.eu/) → Sentinel-2 |
| `SATELLITE_MOCK_MODE` | — | `false` + klucze CDSE = dzienne scany LEO; `true` = tylko Esri |
| `NEXT_PUBLIC_APP_URL` | zalecane | `https://twoja-domena.vercel.app` |
| `CLOUD_COVERAGE_THRESHOLD` | — | domyślnie `0.20` |

4. Deploy → sprawdź `/api/health` (`status: "ok"`).

CLI (opcjonalnie):

```bash
npx vercel
npx vercel --prod
```

### Limity Hobby

- Funkcje satelita/analiza: `maxDuration` 60s (`vercel.json`).
- Pool PG: 1 połączenie na instancję serverless.
- Rate limit in-memory: satelita 20/min, analiza AI 12/min na IP.
- Cache dróg: TTL 30s w pamięci procesu + `Cache-Control`.

## API (skrót)

| Endpoint | Opis |
|----------|------|
| `GET /api/health` | status env + Supabase |
| `GET /api/roads?bbox=&class=&limit=` | drogi w viewportcie |
| `POST /api/satellite/fetch` | skan Sentinel / mock |
| `POST /api/analysis/run` | Gemini Vision + zapis raportu |
| `GET /api/roads/[id]/report` | ostatni raport odcinka |
| `GET /api/reports/[id]` | eksport JSON |
| `GET /api/reports/[id]/pdf` | eksport PDF |

## Roadmapa

Status faz: [`.cursor/plans/PLAN.md`](.cursor/plans/PLAN.md).
