# Darukaa.Earth

Map-first carbon and biodiversity intelligence for landscape restoration programs. Administrators create projects, draw site polygons, and inspect performance over time.

This is a geospatial analytics workspace, not a sustainability marketing site. Identity comes from the map, the numbers, and a Swiss/editorial layout: warm off-white ground, forest green, sage, and lime used only for positive movement.

## High-level architecture

```
React (Vite)  --JWT-->  FastAPI
     |                      |
 Mapbox GL JS          SQLAlchemy 2
 Highcharts            GeoAlchemy2
     |                      |
     +------ PostGIS / PostgreSQL ------+
```

- The SPA owns interaction: login, global map, project list, site detail, and the create-project wizard.
- The API owns identity (JWT), persistence, GeoJSON conversion, and derived Project Health scores.
- PostGIS stores site polygons (`GEOMETRY(Polygon, 4326)`) and supports area calculation via `ST_Area(geom::geography)`.

The SPA has no mock data. Every screen reads from the API: login issues a JWT, the map renders the GeoJSON returned by `/api/sites`, and the wizard POSTs a polygon that PostGIS measures server-side. Satellite tiles appear when `VITE_MAPBOX_TOKEN` is set; without it the map falls back to an equirectangular projection of the same live geometry.

## Why this dataset

Seeded projects are fictional but geographically plausible restorations (Amazon, Sundarbans, Congo Basin, Mau Forest, Borneo peatland, Sierra meadows). They exist so Mapbox has global spread and Highcharts has 2022–2026 carbon, biodiversity, and restoration series without a paid satellite vendor.

## Database schema

| Table | Purpose |
| --- | --- |
| `users` | Administrators (email unique, bcrypt hash) |
| `projects` | Named landscape with country, status, carbon target |
| `sites` | Named polygon + stored `area_ha` |
| `metric_observations` | Annual carbon tCO₂e, biodiversity index, restoration progress per site |

Project Health is **not stored**. The API computes it as a weighted blend of carbon-vs-target (40%), latest biodiversity (30%), and restoration progress (30%).

Alembic revision `0001` enables PostGIS and creates these tables. Locally, FastAPI also calls `create_all` on startup so a first run works before you apply migrations.

## Local setup

### 1. Database

```bash
docker compose up -d
```

Postgres/PostGIS listens on **15432**.

Without Docker, install PostgreSQL and PostGIS directly:

```bash
sudo apt-get install -y postgresql-16 postgresql-16-postgis-3
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE ROLE darukaa LOGIN PASSWORD 'darukaa' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE darukaa OWNER darukaa;"
sudo -u postgres psql -c "CREATE DATABASE darukaa_test OWNER darukaa;"
sudo -u postgres psql -d darukaa -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 2. API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env.example ../.env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --host 0.0.0.0 --port 18765
```

Health check: `GET http://localhost:18765/health`

Demo user after seed: `admin@darukaa.earth` / `darukaa-demo`

### 3. Web app

```bash
cd frontend
npm install
cp ../.env.example .env   # then set VITE_MAPBOX_TOKEN
npm run dev
```

Vite serves on **http://localhost:41782**.

Get a free public Mapbox token from [mapbox.com](https://account.mapbox.com/). Without it, the UI shows a muted globe with the same project pins.

## Code quality

Husky runs **lint-staged** on every commit:

- Prettier on staged `frontend/**/*.{ts,tsx,css,json,md}`
- Ruff on staged `backend/**/*.py`

Install hooks once from the repo root:

```bash
npm install
```

Manual checks:

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
backend/.venv/bin/ruff check backend
cd backend && .venv/bin/pytest
```

The pytest suite is a real integration suite: it runs FastAPI against PostGIS (`darukaa_test`) and covers auth, authorization, the project/site lifecycle, polygon area computation, and error paths.

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and pushes to `main`.

1. **frontend** — Node 22, `npm ci`, Oxlint, production build.
2. **backend** — Python 3.12, Ruff format/check, Alembic against a PostGIS service container, pytest.
3. **deploy** (main only) — If secrets exist:
   - `RENDER_DEPLOY_HOOK` POSTs to Render for the FastAPI service defined in [`render.yaml`](render.yaml).
   - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` deploy the SPA from `frontend/`.

Enable PostGIS on Render Postgres (`CREATE EXTENSION postgis;`) and set `CORS_ORIGINS` to the Vercel URL.

### Required GitHub secrets

| Secret | Used for |
| --- | --- |
| `RENDER_DEPLOY_HOOK` | Render deploy of `darukaa-api` |
| `VERCEL_TOKEN` | Vercel CLI |
| `VERCEL_ORG_ID` | Vercel project |
| `VERCEL_PROJECT_ID` | Vercel project |
| `VITE_API_URL` | Public Render API URL ending in `/api` |
| `VITE_MAPBOX_TOKEN` | Public Mapbox token used by the production build |

Until those secrets are present, CI still gates quality; deploy steps no-op.

## API surface

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | JWT + user |
| POST | `/api/auth/login` | JWT + user |
| GET | `/api/auth/me` | Current user |
| GET | `/api/projects` | Aggregated KPIs |
| POST | `/api/projects` | GeoJSON Polygon sites |
| GET | `/api/projects/{id}` | Includes time series |
| GET | `/api/sites` | FeatureCollection for the map |
| GET | `/api/sites/{id}` | Site analytics |

## Trade-offs

- **JWT in `localStorage`** keeps the SPA deployable on Vercel without a shared cookie domain. XSS is the cost; cookies would be better with a reverse proxy.
- **Highcharts** is used for a denser analytics look. It is acceptable for a non-commercial hackathon demo; Chart.js would be the fully open-source alternative.
- **Create-all plus Alembic** makes first boot easy; production should rely on `alembic upgrade head` (the Docker image does).
- **Server-computed area and health.** `area_ha` comes from `ST_Area(geom::geography)` rather than the browser, and Project Health is derived per request so the score can never drift from stored observations.

## Product map

1. Overview — global map, KPIs, filters  
2. Projects — card/table hybrid of landscapes  
3. Project / site detail — polygon, health score, Highcharts  
4. Create — 01 info → 02 draw sites → 03 review → 04 create  
