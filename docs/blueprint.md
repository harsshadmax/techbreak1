# TechBreak — 1-Day Claude Code Build Blueprint

> A gamified token economy platform to combat digital distraction and promote self-regulation.
> Source: *TechBreak – Gamified Digital Wellness* deck (Team 2, Capstone Project).

This file is written **for Claude Code**. Give it to Claude Code at the start of a session and it should be able to finish the project in about one working day (8–10 hours), phase by phase, verifying each step.

**Start Claude Code with this prompt:**

```text
Read blueprint.md completely. Follow "Part A — Rules for Claude Code", then work
through "Part C — Build Plan" phase by phase, starting at the first phase whose
tasks are not all marked done. After each phase, run that phase's checks, fix
anything that fails, commit, and update the Status column in this file.
Stop and ask me only for the items listed under "Things only the human can do".
```

---

## Part A — Rules for Claude Code

1. **Work in phases, in order.** Each phase in Part C has tasks, acceptance checks and a commit message. Don't start a phase until the previous phase's checks pass.
2. **Check what already exists first.** The repo `techbreak/` may already contain a scaffold (see "Current state" below). Never regenerate or overwrite working code. Read it, verify it, and build on it.
3. **Verify, don't assume.** After every phase run:
   - Server: `cd techbreak/server && npm run typecheck && npm test`
   - App: `cd techbreak/app && flutter analyze && flutter test`

   Fix every error before moving on. Lint *infos* in Flutter may stay; errors and warnings may not.
4. **Commit after each phase** on `main` with the message given in the phase, ending with the Co-Authored-By line. Never commit `.env`, `server/.data/`, `node_modules/` or build output.
5. **Token rules are the core of the product.** Change values only in `server/src/modules/tokens/engine.ts`, and update `server/tests/engine.test.ts` in the same commit.
6. **The server is the source of truth.** The app never computes token awards. It calls the API and shows what comes back.
7. **Keep scope to this file.** If something isn't listed here, don't build it. Note ideas under "Backlog" at the end instead.
8. **Primary target is Flutter Web** (fastest to verify in one day). Android must build; iOS is optional.
9. **When blocked on something only the human can do** (accounts, API keys, installing Flutter), stop and ask. Don't fake it or skip it silently.
10. **Update this file's Status columns** (`⬜` → `✅`) as tasks finish, so a fresh session can resume.

### Things only the human can do

| Item | Needed for | When |
|---|---|---|
| Install Flutter (stable) and Chrome; `flutter doctor` passes for web | Phase 4+ | Before starting |
| Google OAuth client ID | Phase 6 (optional) | Only if doing Google Sign-In |
| MongoDB Atlas + Render (or Railway) + Firebase accounts | Phase 7 (optional) | Only if deploying |
| GitHub repo URL | Pushing / CI | Optional |

---

## Part B — Product Spec

### B1. Summary

**Problem.** Excessive screen time hurts productivity, mental well-being and real-life engagement. Existing apps *monitor* usage but don't *motivate* change, and they give no positive reinforcement for self-control.

**Solution.** Users earn tokens for focus sessions, mindful breaks and daily goals. Tokens are spent on avatar items, perks or donation pledges. Streaks, challenges and leaderboards add motivation.

**Objectives.** Reduce distraction · foster self-regulation · build healthy habits · grow a community.

### B2. Scope for the 1-day build

**Must have**
- Email sign-up / login with refresh tokens
- Onboarding (3 slides + choose daily goal)
- Dashboard: token balance, streak, level, daily goal ring, start-focus button, joined challenges, screen-time entry
- Focus Mode: 25/45/60-minute timer; leaving the app counts as an interruption
- Mindful Breaks: breathing, eye rest, stretch, walk
- Token Engine: earn rules, clean bonus, daily cap, streaks + freezes, levels, ledger
- Rewards Hub: avatar items (buy + equip), streak freeze perk, donation pledges
- Challenges (join, progress, claim) and weekly leaderboard (friends + global)
- Friends by invite code
- Insights: weekly focus chart + token history
- Local time zone used for daily goals and streaks

**Stretch (only after Must-have is done and verified)**
- Google Sign-In
- Web push notifications (FCM)
- Deployment (API + DB + Flutter web)

**Out of scope**
- Real-money token purchases, crypto tokens
- Automatic screen-time reading (Android UsageStats / iOS Screen Time). Screen time is entered manually.
- App blocking, groups/teams, admin panel, real donation-partner payments

### B3. Tech stack

| Layer | Choice |
|---|---|
| App | Flutter 3.29+ (Dart 3.7+): flutter_riverpod 2, go_router 14, dio 5, flutter_secure_storage 9, fl_chart, flutter_timezone, shared_preferences |
| API | Node.js 20+, Express 5, TypeScript 5 (**not** 7: ts-jest and ts-node need v5), Zod 3 |
| Database | MongoDB 7+ via Mongoose 8. **Must be a replica set** (token writes use transactions) |
| Local DB | `npm run db`: a single-node replica set via mongodb-memory-server, data in `server/.data/`. Docker alternative: `docker compose up -d` |
| Auth | bcryptjs, JWT access token (15 min) + rotating refresh token (30 days, stored hashed) |
| Jobs | node-cron, hourly |
| Push | firebase-admin (logs a dry-run when not configured) |
| Tests | Jest + ts-jest + supertest + mongodb-memory-server; flutter_test |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

### B4. Repository layout

```
techbreak/
├── server/
│   ├── src/
│   │   ├── app.ts, server.ts
│   │   ├── config/env.ts
│   │   ├── middleware/   auth.ts, errors.ts
│   │   ├── utils/date.ts
│   │   ├── integrations/push.ts
│   │   ├── jobs/index.ts
│   │   └── modules/
│   │       ├── auth/  users/  sessions/  goals/
│   │       ├── tokens/   engine.ts (pure rules), ledger.ts, transaction.model.ts
│   │       ├── rewards/  challenges/  social/
│   ├── seed/seed.ts
│   ├── scripts/dev-db.ts
│   └── tests/  engine.test.ts, api.test.ts
├── app/
│   ├── lib/
│   │   ├── main.dart
│   │   ├── core/      api_client, config, router, theme, token_store
│   │   ├── shared/    models, widgets, home_shell
│   │   └── features/  auth, onboarding, dashboard, focus, rewards, social, insights, profile
│   └── test/
├── docs/blueprint.md
├── docker-compose.yml
└── .github/workflows/ci.yml
```

### B5. Data model (MongoDB collections)

| Collection | Key fields |
|---|---|
| `users` | email (unique), passwordHash, authProvider, displayName, avatar {base, equipped: Map slot→rewardId}, timezone (IANA), tokenBalance, xp, level, streak {current, longest, lastActiveDate, freezes}, settings {dailyFocusGoalMin=120, dailyScreenLimitMin=240, breakReminders}, inviteCode (unique), friends[], fcmTokens[], lastRolloverDate |
| `sessions` | userId, type focus\|break, breakKind, afterSessionId, plannedMin, actualMin, status active\|completed\|abandoned, interruptions, startedAt, endedAt, platform, tokensAwarded, awards[] |
| `goals` | userId + date (unique), focusTargetMin, focusDoneMin, screenLimitMin, screenUsedMin, achieved, screenBonusAwarded |
| `token_transactions` | userId, amount (+/−), type earn\|burn, reason, refId, day (user-local YYYY-MM-DD), balanceAfter. Append-only |
| `rewards` | slug (unique), kind avatar_item\|perk\|donation, name, description, slot hat\|outfit\|background, cost, cause, active |
| `inventory` | userId + rewardId (unique), acquiredAt |
| `donations` | userId, rewardId, cause, tokens, status, pledgedAt |
| `challenges` | title (unique), metric focus_minutes\|breaks\|streak_days, target, startsAt, endsAt, rewardTokens |
| `challenge_progress` | challengeId + userId (unique), progress, completed, claimedAt |
| `refresh_tokens` | userId, tokenHash (unique), expiresAt (TTL index) |

### B6. Token Engine rules

| Trigger | Tokens | Condition |
|---|---|---|
| Focus session completed | 1 per minute | ≥ 10 min, ≤ 2 interruptions; minutes come from **server timestamps** only |
| Clean bonus | +20% of focus tokens | 0 interruptions |
| Mindful break | +5 | ≥ 1 min, started ≤ 10 min after a completed focus session, once per focus session |
| Daily focus goal reached | +30 | Once per day |
| Streak bonus | +5 × streak days, max 50 | When the daily goal is reached |
| Stayed under screen limit | +20 | Paid by the hourly job for the previous day |
| Challenge completed | challenge.rewardTokens | When claimed |
| Level up | +50 per level | XP to reach level L = Σ round(100 × k^1.5) for k < L. Level-up tokens don't add XP |

| Spend | Cost |
|---|---|
| Avatar items | 50–500 |
| Streak freeze | 150 (hold at most 2) |
| Donation pledge | 100–300 |

**Guards:** daily cap of 400 tokens on focus + clean + break rewards (milestones aren't capped) · max 120 min per session · max 480 focus min credited per day · completing a session is idempotent · balance can never go negative · one active session per user (starting a new one abandons the old one).

**Streaks:** a day counts when the daily goal is reached. The hourly job runs each user's rollover once per local day: if yesterday was missed, it spends a freeze (only when exactly one day was missed), otherwise it resets the streak to 0.

### B7. REST API (`/api/v1`, JSON, Bearer auth except `/auth/*`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` `{email,password,displayName,timezone?}` | → `{accessToken, refreshToken, user}` |
| POST | `/auth/login`, `/auth/google` `{idToken}` | Same response |
| POST | `/auth/refresh`, `/auth/logout` `{refreshToken}` | Rotate / revoke |
| GET / PATCH | `/me` | Profile; PATCH accepts displayName, timezone, settings.* |
| GET | `/me/dashboard` | `{user, goal, challenges[{challenge, progress}]}` |
| PUT | `/me/avatar` `{slot, rewardId\|null}` | Equip an owned item |
| POST | `/me/devices` `{fcmToken}` | Register for push |
| POST | `/sessions` | Focus `{type:'focus', plannedMin, platform}` or break `{type:'break', breakKind, plannedMin, afterSessionId?}` |
| PATCH | `/sessions/:id/interrupt` | +1 interruption |
| POST | `/sessions/:id/complete` | → `{session, awards[], alreadyCompleted}` |
| POST | `/sessions/:id/abandon` | No tokens |
| GET | `/sessions?from&to&limit` | History |
| GET / PUT | `/goals/today` | Today's goal / change targets |
| POST | `/goals/today/screen-time` `{minutes}` | Manual screen-time entry |
| GET | `/tokens/balance`, `/tokens/transactions?before&limit` | Balance and ledger (cursor paging) |
| GET | `/rewards?kind`, `/inventory`, `/donations` | Catalog, owned items, pledges |
| POST | `/rewards/:id/redeem` | Buy item / perk / pledge → `{user}`; 402 if not enough tokens, 409 if already owned |
| GET | `/challenges` | Active challenges with my progress (null = not joined) |
| POST | `/challenges/:id/join`, `/challenges/:id/claim` | Join / claim |
| GET / POST | `/friends` `{inviteCode}` | List / add (mutual) |
| GET | `/leaderboard?scope=global\|friends` | This week's focus minutes ranking |

Errors are `{error: string}` with status 400/401/402/403/404/409/500.

### B8. Screens

| Screen | Contents |
|---|---|
| Onboarding | 3 slides (earn tokens · take breaks · spend rewards) + daily-goal slider. Shown once (shared_preferences flag) |
| Login / Sign-up | Email, password, display name |
| Dashboard | Tokens · streak · level tiles; goal ring; "Start focus session"; screen-time card; joined challenges |
| Focus Mode | Preset picker → countdown → result with award breakdown → "Take a mindful break (+5)" |
| Mindful Break | Pick a kind → breathing circle + countdown → award |
| Rewards Hub | Tabs: Avatar / Perks / Donate; buy, equip; balance in app bar |
| Challenges & Leaderboard | Tabs: Challenges (join/claim) · Friends · Global |
| Insights | Bar chart of focus minutes for the last 7 days; token history list |
| Profile | Avatar with equipped items, level/XP, streak and freezes, daily goal, invite code, add friend, Insights link, sign out |

Design: calm and low-stimulation, Material 3, teal seed color, light and dark themes, short reward animations only.

---

## Part C — Build Plan (one day)

### Current state of the repo

A scaffold already exists and is committed in `techbreak/` (2 commits on `main`). **Verify it in Phase 0, then continue from Phase 4.**

| Area | Status |
|---|---|
| Server: everything in B5–B7, seed, hourly job, push dry-run | ✅ built — 20 tests passing |
| `npm run db` local replica set | ✅ |
| Flutter: login, dashboard, focus, break, rewards, challenges/leaderboard, profile | ✅ code written, **never compiled** (Flutter wasn't installed) |
| Flutter platform folders (`web/`, `android/`, `ios/`) | ⬜ not generated |
| Onboarding, Insights, screen-time card, time zone, avatar display | ⬜ |
| Google Sign-In, push in the app, deployment | ⬜ stretch |

If `techbreak/` does **not** exist, do Phases 1–3 first to build the server from Part B, then continue.

---

### Phase 0 — Environment check (≈ 20 min)

| # | Task | Status |
|---|---|---|
| 0.1 | Check `node -v` (≥ 20), `git --version`, `flutter --version` (Dart ≥ 3.7), `flutter doctor` (Chrome available). If Flutter is missing, **stop and ask the human to install it.** | ⬜ |
| 0.2 | `cd techbreak/server && npm install && cp -n .env.example .env` | ⬜ |
| 0.3 | `npm run typecheck && npm test` all green | ⬜ |
| 0.4 | Start the DB (`npm run db`, in the background), run `npm run seed`, start the API (`npm run dev`). Check `GET /health` → `{ok:true}` and that logging in as `demo@techbreak.test` / `techbreak-demo` returns tokens | ⬜ |

**Checks:** all of the above succeed. No commit needed unless something was fixed (`chore: fix environment setup`).

---

### Phases 1–3 — Server (≈ 3 h; skip if "Current state" says built)

Only for a fresh start. Build in this order, with tests per step:

1. **Foundation:** Express app, env config, error handler, JWT auth middleware, User model, auth routes (register/login/refresh/logout with refresh rotation), `/me`. Commit `feat(server): foundation and auth`.
2. **Token Engine + sessions:** `engine.ts` (pure functions for every rule in B6) with unit tests first; ledger (`grant`, `spend`, `cappedEarnedToday`) inside Mongo transactions; sessions start/interrupt/complete/abandon; goals; dashboard. Commit `feat(server): token engine, sessions and goals`.
3. **Economy + social:** rewards/inventory/donations/redeem/equip; challenges join/progress/claim; friends; leaderboard aggregation; hourly job; push dry-run; seed script; `npm run db`. Commit `feat(server): rewards, challenges, social and jobs`.

**Checks:** the API test covers register → focus (backdate `startedAt`) → complete (awards 25+5+30+5 with a 20-minute goal) → completing again returns `alreadyCompleted` → break +5 → redeem 50 → 402 on an unaffordable item → the ledger sum equals `tokenBalance`.

---

### Phase 4 — Make the Flutter app build and run (≈ 1.5 h)

| # | Task | Status |
|---|---|---|
| 4.1 | `cd techbreak/app && flutter create . --platforms=web,android,ios --project-name techbreak` (keeps the existing `lib/`, `test/` and `pubspec.yaml`; if `pubspec.yaml` gets overwritten, restore it from git) | ⬜ |
| 4.2 | `flutter pub get`, then `flutter analyze` and fix every **error and warning**. Likely spots: Riverpod 2 / go_router 14 API differences, `CardThemeData`, `withValues`, `PopScope.onPopInvokedWithResult` | ⬜ |
| 4.3 | `flutter test` passes | ⬜ |
| 4.4 | Add a preview configuration so the app can be opened in the browser pane: `flutter run -d web-server --web-port 8080` (or `flutter build web` served statically). Make sure the server's `CORS_ORIGINS` allows it (default `*`) | ⬜ |
| 4.5 | **Manual flow in the browser:** sign up → dashboard → start a 25-min focus → "Finish early" (no tokens under 10 min, which is expected) → abandon flow works → Rewards tabs load the seeded items → Challenges list 3 items → Profile shows the invite code → sign out returns to login | ⬜ |

To test earning without waiting 25 minutes, backdate the active session in Mongo (`startedAt` = now − 26 min) and press "Finish early". Or add a dev-only server env flag `DEV_FAST_MINUTES=1` that treats 1 second as 1 minute, guarded by `NODE_ENV !== 'production'`, with a test.

**Checks:** `flutter analyze` has no errors or warnings · `flutter test` green · the flow in 4.5 works with no console errors.
**Commit:** `feat(app): generate platforms and fix build`

---

### Phase 5 — Finish the Must-have features (≈ 3 h)

| # | Task | Details | Status |
|---|---|---|---|
| 5.1 | Local time zone | Add `flutter_timezone`; send the IANA zone on register; on app start, if `user.timezone` differs from the device, `PATCH /me {timezone}`. Remove the TODO in `auth_controller.dart` | ⬜ |
| 5.2 | Onboarding | `features/onboarding/onboarding_screen.dart`: 3 PageView slides + goal slider (10–300 min, steps of 10). Runs after first sign-up and sets `settings.dailyFocusGoalMin` via `PATCH /me` and today's goal via `PUT /goals/today`. Stores a `shared_preferences` flag; router redirect sends first-time users here | ⬜ |
| 5.3 | Screen-time card | Dashboard card: "Screen time today" + "Log" button → number dialog → `POST /goals/today/screen-time`. Show used vs. limit and note that the +20 bonus is paid the next day | ⬜ |
| 5.4 | Insights screen | `features/insights/insights_screen.dart`, route `/insights`, opened from Profile. Use `fl_chart` for a 7-day bar chart of completed focus minutes (from `GET /sessions?from=<7 days ago>&limit=200`, grouped by local date on the client) plus totals (minutes, sessions, tokens this week) and a paged token history list (`GET /tokens/transactions`, infinite scroll with `before` cursor) | ⬜ |
| 5.5 | Avatar display | `shared/avatar_view.dart`: base emoji (🦊) with equipped items drawn as stacked icons/emoji per slot (hat on top, outfit badge, background color from the background item). Map reward slugs to visuals in one table. Use it in Profile and the dashboard header | ⬜ |
| 5.6 | Polish | Pull-to-refresh on every list; empty states; snackbar errors use `apiErrorMessage`; after redeeming, the balance updates everywhere; a reward-earned animation (scale/fade on the token total, no extra packages) | ⬜ |
| 5.7 | Tests | Widget tests for: login form validation, Award list total, Insights grouping function (pure function, unit-tested), avatar mapping | ⬜ |

**Checks:** analyze clean · all tests green · the manual flow in 4.5 plus: onboarding shows once; logging screen time updates the card; Insights shows today's bar after a backdated completed session; equipping a hat changes the avatar in Profile.
**Commit:** `feat(app): onboarding, insights, screen time, avatar, timezone`

---

### Phase 6 — End-to-end verification (≈ 1 h)

| # | Task | Status |
|---|---|---|
| 6.1 | Fresh DB (stop `npm run db`, delete `server/.data`, restart, seed). Run the **full journey** in the browser: sign up → onboarding (goal 20 min) → join "Focus Five" → 25-min focus session (backdate) → see 25 + 5 + 30 + 5 = **65 tokens**, streak 1, "Focus Five" at 25/300 → mindful break → +5 (**70**) → buy Cozy Beanie (50) → **20** left → equip it | ⬜ |
| 6.2 | Second user: sign up in a private window, add the first user by invite code, check both appear on the Friends leaderboard | ⬜ |
| 6.3 | Run the hourly job by hand (a small script or test) and confirm streak rollover and the screen-limit bonus | ⬜ |
| 6.4 | `flutter build web --release` and `flutter build apk --debug` both succeed | ⬜ |
| 6.5 | Update `README.md`: setup, run, demo login, what's implemented; screenshots optional | ⬜ |

**Checks:** every number in 6.1 matches. **Commit:** `test: end-to-end verification and docs`

---

### Phase 7 — Stretch (only with time left and the human's accounts)

| # | Task | Needs from human | Status |
|---|---|---|---|
| 7.1 | Google Sign-In on web/Android with `google_sign_in`, posting the ID token to `/auth/google` | OAuth client ID | ⬜ |
| 7.2 | Web push with `firebase_messaging`: register the token via `POST /me/devices`; server sends with `FIREBASE_SERVICE_ACCOUNT` | Firebase project | ⬜ |
| 7.3 | Deploy: API on Render (`render.yaml` web service, `npm ci && npm run build`, `npm start`), DB on MongoDB Atlas (replica set by default), Flutter web on Render static site or Firebase Hosting with `API_BASE_URL` set via `--dart-define`. Set production secrets; `CORS_ORIGINS` = the web URL | Render/Atlas accounts | ⬜ |

Commit each as `feat: <item>`.

---

## Part D — Definition of Done

- [ ] A new user can sign up, finish onboarding, complete a focus session, earn tokens, take a break, buy and equip an avatar item, join a challenge and see Insights, on **Flutter Web**.
- [ ] The Android debug APK builds.
- [ ] `npm run typecheck`, `npm test`, `flutter analyze`, `flutter test` are all clean.
- [ ] The token ledger sum equals `tokenBalance` for every user (asserted in the API test).
- [ ] The full journey in 6.1 produces exactly the listed numbers.
- [ ] README explains setup in under 10 commands.
- [ ] Every phase is committed; the Status columns in this file are updated.

## Suggested timeline

| Time | Phase |
|---|---|
| 0:00–0:20 | Phase 0: environment check |
| 0:20–1:50 | Phase 4: Flutter build + first run |
| 1:50–4:50 | Phase 5: remaining features |
| 4:50–5:50 | Phase 6: end-to-end verification |
| 5:50–8:00 | Phase 7: stretch, or buffer for fixes |

(A fresh start without the scaffold adds about 3 hours for Phases 1–3.)

## Backlog (not for this build)

Android UsageStats screen-time tracking · app blocking during focus · groups/classrooms · admin panel for rewards and challenges · weekly leaderboard snapshots · real donation partners · iOS Screen Time API · Lottie/Rive animations · localization.
