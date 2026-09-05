# Darukaa.Earth Hackathon Feature Report

This report maps the challenge requirements to working product behavior, source code, and
automated verification. The optional seed is a documented synthetic demonstration dataset; the
application itself reads and writes all portfolio data through the API.

## Requirement coverage

### User authentication

- Registration, login, JWT issuance, session restoration, expiry handling, and logout are
  implemented by `backend/app/security.py`, `backend/app/api.py`, `frontend/src/api.ts`, and
  `frontend/src/App.tsx`.
- Passwords are bcrypt hashes. Protected API routes require a bearer token.
- Authentication and invalid-credential paths are covered by backend integration tests.

### Project management

- Administrators can create projects with a name, country, purpose, status, carbon target, and one
  or more geographical sites.
- Projects can be listed, opened, edited, and deleted through the React dashboard and FastAPI.
- All authenticated administrators intentionally share the same portfolio. This matches the
  challenge's administrator workspace rather than introducing an unrequested tenant model.

### Geospatial site management

- Site boundaries are authored as exact GeoJSON polygons with Mapbox GL JS and Mapbox Draw.
- A coordinate editor provides a non-pointer fallback and makes imported or precisely surveyed
  coordinates possible.
- Sites can be added to existing projects, edited, and deleted.
- PostGIS validates each polygon and calculates hectares with
  `ST_Area(geometry::geography)`. Browser-calculated area is never trusted.
- The portfolio, project, and site views render the API's GeoJSON rather than hardcoded pins.

### Dynamic environmental observations

- Carbon storage, biodiversity index, and restoration progress observations are stored per site
  and date in `metric_observations`.
- Administrators can add, edit, and remove observations after a project is created.
- Site, project, and portfolio aggregates are recalculated from current database rows on every
  request; no KPI or chart series is embedded in the frontend.
- Project and site health are canonical API-derived values, preventing frontend/backend formula
  drift.

### Interactive analytics

- Highcharts visualizes all three requested dimensions over time.
- Site details show boundary, latest KPIs, health, and observation history.
- Project details aggregate observations across their sites by date.
- Portfolio analytics compares live project performance and supports interactive filtering.
- Empty, loading, API error, and retry states are explicit.

### Automated code quality

- Husky invokes lint-staged before commits.
- Prettier and Oxlint check staged frontend code; Ruff formats and lints staged Python.
- GitHub Actions runs frontend lint, tests, TypeScript production build, backend formatting,
  linting, Alembic migrations, and PostGIS integration tests.
- Deployment is gated on both quality jobs. Conditional smoke checks verify configured public
  URLs after deployment.

### Deployment

- `backend/Dockerfile` and `render.yaml` define the Render API deployment.
- `frontend/vercel.json` defines SPA routing for Vercel.
- `.github/workflows/ci.yml` deploys from `main` only when the documented repository secrets are
  available.
- Deployment credentials and provider accounts are deliberately not stored in the repository.

## Architecture

```text
React 19 / Vite
  |-- Mapbox GL JS + Mapbox Draw
  |-- Highcharts
  |-- JWT REST client
  v
FastAPI
  |-- Pydantic request/response validation
  |-- SQLAlchemy / GeoAlchemy2
  |-- canonical aggregation and health calculations
  v
PostgreSQL + PostGIS
  |-- users
  |-- projects
  |-- sites (Polygon, SRID 4326)
  `-- metric_observations
```

Alembic is the schema source of truth. Local Docker and CI use the same PostGIS major version.

## Data choice and provenance

The included seed uses fictional but geographically plausible restoration programs distributed
across several biomes. Synthetic observations make map and time-series behavior reviewable without
requiring a commercial satellite API, accepting incompatible third-party licenses, or presenting
unverified environmental claims as real.

The seed is optional (`python -m app.seed`). It is not a runtime fallback. Every seeded row uses the
same relational models consumed by normal API reads, and administrators can replace the data using
the application's project, site, and observation workflows.

## Database schema

- `users`: administrator identity, unique email, bcrypt password hash, timestamps.
- `projects`: creator audit reference, name, country, description, lifecycle status, carbon target,
  timestamps.
- `sites`: project foreign key, name, PostGIS polygon, server-computed hectares, timestamps.
- `metric_observations`: site foreign key, observation date, carbon tCO2e, biodiversity 0–100,
  restoration progress 0–100.

Foreign-key cascades make project/site deletion deterministic. API validation prevents invalid
metric ranges and malformed polygons.

## Security and product trade-offs

- JWTs in local storage keep the frontend independently deployable on Vercel. A same-origin,
  HTTP-only cookie is preferable for a production system behind one domain.
- Registration is open for challenge evaluation. A production administrator workspace should add
  invitations, email verification, rate limits, and password recovery.
- The challenge describes an administrator viewing all projects, so authenticated administrators
  share the portfolio. A production multi-customer service should add organizations and row-level
  authorization.
- Highcharts is appropriate for this non-commercial evaluation. A commercial launch must confirm
  its license or switch to Chart.js.
- A public Mapbox token is expected in browser builds and should be URL-restricted in the Mapbox
  dashboard.

## Evaluator walkthrough

1. Register or sign in.
2. Create a project, set its target, draw multiple polygons, and submit.
3. Open the project and add another site.
4. Open a site and record measurements on at least two dates.
5. Edit one observation and verify the three charts and health/KPIs update.
6. Open portfolio analytics and compare the project with the rest of the portfolio.
7. Edit a boundary and confirm its area changes after PostGIS recalculation.
8. Delete a test observation, site, and project and confirm all lists/maps update.
9. Open Settings and verify the live `/health` plus `/ready` result (API process and database reachable).

## Evaluation evidence

- Technical excellence: typed React/FastAPI boundaries, PostGIS-native geometry, Alembic,
  integration tests, strict builds, pre-commit checks, and CI-gated deployment.
- Product mindedness: map-first creation, multi-site lifecycle, writable field observations,
  meaningful empty/error states, server-derived KPIs, and an immediately reviewable optional
  dataset.
- Communication: this report plus `README.md` documents architecture, schema, setup, CI/CD,
  dataset rationale, security decisions, and trade-offs.

No repository can guarantee a judge-assigned score. This implementation instead provides
traceable evidence for every explicit challenge requirement and states production limitations
honestly.
