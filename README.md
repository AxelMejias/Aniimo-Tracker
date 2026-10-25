# Aniimo Team Tracker

**A free desktop companion app for Aniimo (PC) to keep track of your teams and, later on, compare them with friends.**

Unofficial fan project, not affiliated with or endorsed by the Aniimo developers or publisher. Game names and trademarks belong to their owners.

> **Status:** early development, pre-release. The account system, team tracker and Aniimo cards are implemented and tested; friends, the overlay and stat comparison are still planned. Nothing has been released and it has not been tested with other players yet.

## Why

Between level, stars, Capability Awakening, Potential, personality and Held Items, there is a lot to keep track of for every Aniimo, and it gets messy once you have a few teams. We were doing it in a spreadsheet, so this is the spreadsheet turned into an app.

## What works today

- **Accounts:** register, login, logout and session check. Passwords are hashed with Argon2, sessions expire, and login/registration attempts are rate limited.
- **Teams:** create, rename and delete teams, with a limit on how many teams you can have.
- **Aniimo cards:** each team has slots for Aniimo. A card stores level, star stage, Capability Awakening progress, Potential per stat, personality (four-letter type), Held Items, materials, role and element, with validation on both the desktop app and the backend.
- **Images:** you can attach your own image to an Aniimo card. The backend checks the real file type and enforces a size limit.

## Planned

1. Friend profiles and side-by-side stat comparison.
2. An optional always-on-top overlay window you can move to a second monitor (a separate window, it doesn't draw inside the game).
3. How stats grow with each upgrade, based on data players enter.
4. Official API integration, only if the developers approve it.

## How data gets in

You type it in. The app does not:

- read or modify game memory
- inject code or hook the game process
- touch game files
- intercept network traffic
- automate anything in the game or give any in-game advantage

No game art is included or downloaded. If you want an image for an Aniimo, you add it yourself.

If the developers ever offer an official API or an approved way to read a player's own data, that would be the only automatic source this project uses.

## Stack

| Layer | Technology |
|---|---|
| Desktop app | Electron, React, TypeScript (electron-vite) |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | PostgreSQL 16, Alembic migrations |
| Security | Argon2 password hashing, rate limiting, session expiry |
| Tests | pytest (backend), Vitest + Testing Library (desktop app) |
| Tooling | Docker Compose for the databases, ESLint and Ruff |

Everything runs locally for now.

## Architecture

The backend is organized in layers, so business rules don't depend on the framework or the database:

```
backend/app/
├── domain/           # Entities, rules and errors (no framework imports)
├── application/      # Use cases (auth, teams) and the Unit of Work
├── infrastructure/   # Database models, mapping, password hashing
├── api/              # FastAPI routers, request/response schemas, rate limiting
└── core/             # Settings, logging, clock, error handling
```

- **Domain first:** limits and validations (such as the maximum number of teams, or the valid range for Potential) live in the domain layer and are tested on their own.
- **Unit of Work:** use cases talk to the database through a Unit of Work, which keeps transactions in one place.
- **Migrations:** every schema change is an Alembic migration.

The desktop app is organized by feature (`auth`, `teams`, `aniimo`) with its own tests.

## Run it

Requirements: Docker, Python 3.11+ and Node.js.

```bash
# 1. Databases (set POSTGRES_PASSWORD in a .env file at the repo root first)
docker compose up -d db

# 2. Backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # use the same password you set for Postgres
alembic upgrade head
python -m app

# 3. Desktop app (in another terminal)
cd frontend
npm install
npm run dev
```

## Tests

```bash
# Backend (needs the test database: docker compose up -d db-test)
cd backend && pytest

# Desktop app
cd frontend && npm test
npm run typecheck
npm run lint
```

## Contact

Axel ([@AxelMejias](https://github.com/AxelMejias)). If you're part of the Aniimo team and something here goes against your rules, let me know and I'll change it or take it down.

It's free and will stay free: no ads, no paywall, no selling data.

## License

MIT, see [LICENSE](LICENSE).
