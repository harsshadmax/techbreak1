# TechBreak

A gamified token economy platform to combat digital distraction and promote self-regulation.
Users earn tokens for focus sessions and mindful breaks, then spend them on avatar items, perks, or donation pledges.

See [docs/blueprint.md](docs/blueprint.md) for the full product and technical plan.

```
techbreak/
├── server/   Node.js + Express + MongoDB API (TypeScript), including the Token Engine
├── web/      React + TypeScript + Tailwind CSS client (the app)
├── app/      Earlier Flutter client (superseded by web/, kept for reference)
└── docs/     Blueprint and design docs
```

## Quick start (web)

Needs Node.js 20+. Run each block in its own terminal:

```bash
cd server && cp .env.example .env && npm install
npm run db                # local MongoDB replica set (data in server/.data), leave running
```

```bash
cd server
npm run seed              # rewards catalog, this week's challenges, demo user
npm run dev               # API on http://localhost:4000/api/v1
```

```bash
cd web && npm install
npm run dev                # then open http://localhost:5173
```

Sign in with the demo user `demo@techbreak.test` / `techbreak-demo` (`SEED_DEMO_PASSWORD` in `server/.env`), or create an account.

## Prerequisites

- Node.js 20+
- MongoDB **running as a replica set** (token operations use transactions): `npm run db`
  (no Docker needed), `docker compose up -d`, or a free MongoDB Atlas cluster

## Run the API

```bash
cd server
cp .env.example .env      # then edit MONGO_URI / secrets if needed
npm install
npm run seed              # rewards catalog, this week's challenges, demo user
npm run dev               # http://localhost:4000/api/v1
```

Tests use an in-memory MongoDB replica set (downloaded automatically on first run):

```bash
npm test
npm run typecheck
```

## Run the app

```bash
cd web
npm install
npm run dev                # http://localhost:5173
npm run typecheck && npm test
npm run build
```

Point the app at a different API with `VITE_API_BASE_URL` (see `web/.env.example`).

To try earning tokens without waiting 25 minutes, move the active session's `startedAt` back in MongoDB, then press "Finish early".

## What's implemented

| Area | Server | App |
|---|---|---|
| Auth (email, refresh-token rotation) | ✅ | ✅ |
| Google sign-in | ✅ `/auth/google` | ⏳ TODO |
| Dashboard (balance, streak, goal, challenges) | ✅ | ✅ |
| Focus Mode with interruption tracking | ✅ | ✅ |
| Mindful breaks | ✅ | ✅ |
| Token Engine: earn rules, clean bonus, daily cap, streaks, freezes, levels | ✅ | — |
| Rewards hub: avatar items, perks, donations, equip | ✅ | ✅ |
| Challenges (join, progress, claim) | ✅ | ✅ |
| Friends + weekly leaderboard | ✅ | ✅ |
| Hourly job: streak rollover, screen-limit bonus, streak reminders | ✅ | — |
| Push notifications (FCM) | ✅ (dry-run without credentials) | ⏳ TODO |
| Screen-time entry | ✅ `/goals/today/screen-time` | ✅ |
| Onboarding, local time zone, avatar display | ✅ | ✅ |
| Insights (7-day chart, token history) | ✅ | ✅ |

## API overview

All routes are under `/api/v1` and need `Authorization: Bearer <accessToken>` except `/auth/*`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/google` | Get an access + refresh token pair |
| POST | `/auth/refresh`, `/auth/logout` | Rotate / revoke the refresh token |
| GET / PATCH | `/me` | Profile and settings |
| GET | `/me/dashboard` | User, today's goal and joined challenges |
| PUT | `/me/avatar` | Equip an owned item `{slot, rewardId}` |
| POST | `/me/devices` | Register an FCM token |
| POST | `/sessions` | Start a focus or break session |
| PATCH | `/sessions/:id/interrupt` | Report leaving the app |
| POST | `/sessions/:id/complete` | Finish and receive tokens (idempotent) |
| POST | `/sessions/:id/abandon` | Give up (no tokens) |
| GET | `/sessions` | History |
| GET / PUT | `/goals/today` | Today's goal and targets |
| POST | `/goals/today/screen-time` | Report screen-time minutes |
| GET | `/tokens/balance`, `/tokens/transactions` | Balance and ledger |
| GET | `/rewards`, `/inventory`, `/donations` | Catalog and what you own/pledged |
| POST | `/rewards/:id/redeem` | Spend tokens (avatar item, perk or donation) |
| GET | `/challenges` | Active challenges with your progress |
| POST | `/challenges/:id/join`, `/challenges/:id/claim` | Join / claim reward |
| GET / POST | `/friends` | List / add by invite code |
| GET | `/leaderboard?scope=global\|friends` | This week's focus ranking |

Token rules live in [server/src/modules/tokens/engine.ts](server/src/modules/tokens/engine.ts) — tune values there.

