# TechBreak — Build Blueprint

> A gamified token economy platform to combat digital distraction and promote self-regulation.
> Source: *TechBreak – Gamified Digital Wellness* deck (Team 2, Capstone Project).

This document turns the pitch deck into a buildable plan: scope, architecture, data model, token rules, API, screens, and a 14-week schedule.

---

## 1. Product Summary

**Problem.** Excessive screen time hurts productivity, mental well-being and real-life engagement. Existing apps *monitor* usage but don't *motivate* change, and they offer no positive reinforcement for self-control.

**Solution.** TechBreak rewards users with tokens for staying focused, taking mindful breaks and hitting goals. Tokens are spent on avatar customization, rewards, or donations to causes. Leaderboards and challenges add social motivation.

**Objectives**
1. Reduce distraction — minimize excessive screen time across devices.
2. Foster self-regulation — positive reinforcement for proactive self-control.
3. Build healthy habits — consistency through gamification (streaks, levels).
4. Grow a community — challenges and leaderboards toward a balanced digital life.

**Success metrics** (measure during beta)
| Metric | Target |
|---|---|
| Avg. daily focus minutes per active user | ↑ week over week |
| Daily screen time (self-reported / device data) | ↓ 15–20% after 4 weeks |
| 7-day streak retention | ≥ 30% of users |
| D7 / D30 retention | ≥ 40% / ≥ 20% |
| Productivity self-score (survey, 1–10) | Deck goal: "2.5x productivity gain" — validate via pre/post survey |

---

## 2. Scope

### MVP (must have by Week 14)
- Sign up / login (email + Google OAuth)
- **Dashboard**: today's focus goal, token balance, streak, quick-start focus button
- **Focus Mode**: timer-based sessions (Pomodoro-style presets + custom), earn tokens on completion
- **Mindful Breaks**: guided break prompts (breathing, stretch, walk, eye rest) after focus sessions
- **Goals**: daily focus goal + daily screen-time limit
- **Token Engine**: earn rules, streaks, bonuses, burn (spend) rules, ledger
- **Rewards Hub**: avatar items store + donation pledges
- **Leaderboards** (weekly, friends + global) and **Challenges** (e.g., "5 focus hours this week")
- Push notifications (break reminders, streak at risk, challenge updates)
- Basic analytics/history (weekly focus chart, token history)

### Post-MVP (nice to have)
- Android usage-stats integration (real screen-time tracking per app)
- Groups / teams (classrooms, workplaces)
- Real donation partner integration
- App blocking during Focus Mode (Android)
- Admin web panel for rewards, challenges and moderation

### Out of scope
- Real-money purchase of tokens (keeps economy fair; avoids pay-to-win)
- Cryptocurrency / blockchain tokens

---

## 3. Tech Stack

| Layer | Choice (from deck) | Notes |
|---|---|---|
| Frontend | **Flutter** (Web + Android + iOS) | Single codebase. State: Riverpod (or Bloc). HTTP: Dio. Charts: fl_chart. |
| Backend | **Node.js + Express** | TypeScript recommended. Validation: Zod. Auth: JWT (access + refresh). |
| Database | **MongoDB** | Mongoose ODM. Use transactions (replica set / Atlas) for token operations. |
| Token Engine | Custom module inside backend | Pure, testable rule functions + append-only ledger. |
| Push | Firebase Cloud Messaging (FCM) | Works for Android, iOS, Web. |
| Analytics | Firebase Analytics or PostHog | Funnel + retention tracking. |
| OAuth | Google Sign-In | Apple Sign-In required if shipping to iOS App Store with Google login. |
| Jobs / scheduling | node-cron or Agenda (Mongo-backed) | Streak resets, weekly leaderboard rollover, reminders. |
| Hosting | Render / Railway / Fly.io (API), MongoDB Atlas (DB), Firebase Hosting (Flutter web) | Free/cheap tiers work for capstone. |
| CI | GitHub Actions | Lint, test, build on every PR. |

---

## 4. System Architecture

```
┌────────────────────────── Flutter App (Web / Android / iOS) ──────────────────────────┐
│  Dashboard │ Focus Mode │ Breaks │ Goals │ Rewards Hub │ Leaderboard │ Profile/Avatar │
│            State (Riverpod) · API client (Dio) · Local cache (Hive) · FCM client      │
└───────────────────────────────────────┬───────────────────────────────────────────────┘
                                        │ HTTPS / JSON (JWT)
┌───────────────────────────────────────▼───────────────────────────────────────────────┐
│                           Node.js / Express API (REST, /api/v1)                       │
│  Auth Service │ Task/Session Service │ Goal Service │ Reward Service │ Social Service │
│                                   │                                                    │
│                         ┌─────────▼──────────┐       ┌──────────────────┐             │
│                         │    Token Engine     │       │  Scheduled Jobs  │             │
│                         │ earn · streak ·     │◄──────│ streaks, weekly  │             │
│                         │ bonus · burn ·      │       │ rollover, nudges │             │
│                         │ anti-abuse caps     │       └──────────────────┘             │
│                         └─────────┬──────────┘                                         │
└───────────────────────────────────┼───────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼──────────────────────────┐
          ▼                         ▼                          ▼
     MongoDB Atlas          Firebase (FCM, Analytics)     Google OAuth
```

### System Modules (from deck)
| Component | Sub-modules | Responsibilities |
|---|---|---|
| Frontend | UI/UX, State, API Integration | Dashboard, Focus Mode, Rewards Store |
| Backend API | Auth, Token, Task, Reward | Service orchestration and business logic |
| Token Engine | Earn Rules, Rewards Logic | Streaks, bonuses, token burn |
| External Services | Push, Analytics, OAuth | Notifications and third-party integrations |

---

## 5. Repository Structure

Monorepo:

```
techbreak/
├── app/                        # Flutter client
│   ├── lib/
│   │   ├── main.dart
│   │   ├── core/               # theme, router (go_router), constants, api client
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── focus/          # timer, session lifecycle, break prompts
│   │   │   ├── goals/
│   │   │   ├── rewards/        # store, inventory, donations
│   │   │   ├── social/         # leaderboard, challenges, friends
│   │   │   └── profile/        # avatar, settings, history
│   │   └── shared/             # widgets, models
│   └── test/
├── server/                     # Node.js / Express API
│   ├── src/
│   │   ├── app.ts / server.ts
│   │   ├── config/
│   │   ├── middleware/         # auth, validation, rate limit, errors
│   │   ├── modules/
│   │   │   ├── auth/           # routes, controller, service, model
│   │   │   ├── users/
│   │   │   ├── sessions/       # focus + break sessions
│   │   │   ├── goals/
│   │   │   ├── tokens/         # token engine + ledger
│   │   │   ├── rewards/
│   │   │   ├── challenges/
│   │   │   └── leaderboard/
│   │   ├── jobs/               # cron jobs
│   │   └── integrations/       # fcm, analytics, oauth
│   ├── tests/
│   └── seed/                   # rewards catalog, sample challenges, test users
├── docs/                       # this blueprint, API spec (OpenAPI), diagrams
└── .github/workflows/
```

---

## 6. Data Model (MongoDB)

```js
// users
{
  _id, email, passwordHash?, authProvider: "local" | "google",
  displayName, avatar: { base: "fox", equipped: { hat, outfit, background } },
  timezone: "Asia/Kolkata",
  tokenBalance: 0,             // cached; ledger is source of truth
  level: 1, xp: 0,
  streak: { current: 0, longest: 0, lastActiveDate: "2026-10-28" },
  settings: { dailyFocusGoalMin: 120, dailyScreenLimitMin: 240, breakReminders: true },
  friends: [userId], fcmTokens: [String],
  createdAt, updatedAt
}

// sessions  (focus & break sessions)
{
  _id, userId, type: "focus" | "break",
  breakKind?: "breathing" | "stretch" | "walk" | "eye_rest",
  plannedMin: 25, actualMin: 25,
  status: "active" | "completed" | "abandoned",
  interruptions: 0,            // app backgrounded / tab hidden events
  startedAt, endedAt, deviceId, platform: "web" | "android" | "ios"
}

// goals
{ _id, userId, date: "2026-10-28", focusTargetMin, focusDoneMin,
  screenLimitMin, screenUsedMin?, achieved: false }

// token_transactions  (append-only ledger)
{
  _id, userId, amount: +10 | -50,
  type: "earn" | "burn",
  reason: "focus_complete" | "break_complete" | "goal_achieved" | "streak_bonus"
        | "challenge_reward" | "reward_redeem" | "donation",
  refId,                       // sessionId / rewardId / challengeId
  balanceAfter, createdAt
}

// rewards  (catalog)
{ _id, kind: "avatar_item" | "donation" | "perk", name, slot?, cost,
  imageUrl, cause?, active: true, stock? }

// inventory
{ _id, userId, rewardId, acquiredAt }

// donations
{ _id, userId, cause, tokens, pledgedAt, status: "pledged" | "fulfilled" }

// challenges
{ _id, title, description, metric: "focus_minutes" | "breaks" | "streak_days",
  target, startsAt, endsAt, rewardTokens, scope: "global" | "friends" | "group" }

// challenge_progress
{ _id, challengeId, userId, progress, completed, claimedAt? }

// leaderboard_snapshots  (weekly)
{ _id, weekStart, entries: [{ userId, focusMin, tokensEarned, rank }] }
```

**Indexes:** `sessions(userId, startedAt)`, `token_transactions(userId, createdAt)`, `goals(userId, date)` unique, `challenge_progress(challengeId, userId)` unique, `users(email)` unique.

---

## 7. Token Engine

The heart of the product. Implement as pure functions (`computeEarn(session, user, todayStats) → TokenTx[]`) so rules are unit-testable, then apply them in a MongoDB transaction that writes ledger rows and updates `tokenBalance`.

### 7.1 Earn rules (starting values — tune in beta)
| Trigger | Tokens | Condition |
|---|---|---|
| Focus session completed | **1 per focused minute** (25-min = 25) | ≥ 10 min, status `completed`, ≤ 2 interruptions |
| Clean session bonus | +20% | 0 interruptions |
| Mindful break completed | +5 | Break taken within 10 min after focus session |
| Daily focus goal hit | +30 | Once per day |
| Stayed under screen limit | +20 | Once per day (when screen data available) |
| Streak bonus | +5 × streak day (cap +50) | Awarded on first goal of the day |
| Challenge completed | challenge.rewardTokens | Once per challenge |
| Level-up | +50 | XP threshold crossed |

### 7.2 Burn rules (sinks)
| Action | Cost |
|---|---|
| Avatar items | 50–500 by rarity |
| Donation pledge | 100+ (e.g., 100 tokens = "plant a tree" pledge) |
| Streak freeze (protect streak one day) | 150, max 2 held |
| Abandoned focus session | 0 tokens earned (no penalty — keep it positive) |

### 7.3 Streaks
- A day "counts" if the user completes ≥ 1 focus session **and** hits the daily focus goal.
- Nightly job (per user timezone) checks yesterday; if missed and no freeze → `streak.current = 0`.

### 7.4 Levels / XP
- XP = lifetime tokens earned (not spent). Level thresholds: `100 × level^1.5`.

### 7.5 Anti-abuse guards
- **Daily earn cap** (e.g., 400 tokens/day) to stop timer farming.
- Max focus session length 120 min; max 8 hours focus credited per day.
- Server validates `startedAt`/`endedAt` against server time — client can't submit arbitrary durations. Session must be started via API and completed via API.
- Interruption tracking: Flutter `AppLifecycleState` (mobile) and `visibilitychange` (web) report backgrounding.
- Idempotency key on completion endpoint to avoid double-awards.
- Balance can never go negative (check inside transaction).

---

## 8. REST API (v1)

All routes under `/api/v1`, JSON, JWT bearer auth except auth endpoints.

**Auth**
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Email signup |
| POST | `/auth/login` | Email login → access + refresh tokens |
| POST | `/auth/google` | Exchange Google ID token |
| POST | `/auth/refresh` | Rotate tokens |
| POST | `/auth/logout` | Revoke refresh token |

**User / Dashboard**
| GET | `/me` | Profile, balance, streak, level |
|---|---|---|
| PATCH | `/me` | Update name, settings, timezone |
| GET | `/me/dashboard` | Today's goal progress, balance, streak, active challenges |
| POST | `/me/devices` | Register FCM token |

**Sessions (Focus Mode & Breaks)**
| POST | `/sessions` | Start focus/break session `{type, plannedMin}` |
|---|---|---|
| PATCH | `/sessions/:id/interrupt` | Report interruption |
| POST | `/sessions/:id/complete` | Complete → returns tokens awarded |
| POST | `/sessions/:id/abandon` | Abandon |
| GET | `/sessions?from&to` | History |

**Goals**
| GET | `/goals/today` | Today's goal + progress |
|---|---|---|
| PUT | `/goals/today` | Set targets |
| POST | `/goals/today/screen-time` | Report screen-time minutes (manual or device) |

**Tokens**
| GET | `/tokens/balance` | Balance |
|---|---|---|
| GET | `/tokens/transactions?cursor` | Ledger history |

**Rewards Hub**
| GET | `/rewards?kind` | Catalog |
|---|---|---|
| POST | `/rewards/:id/redeem` | Spend tokens |
| GET | `/inventory` | Owned items |
| PUT | `/me/avatar` | Equip items |
| POST | `/donations` | Pledge tokens to a cause |

**Social**
| GET | `/leaderboard?scope=global\|friends&period=week` | Rankings |
|---|---|---|
| GET | `/challenges` | Active challenges + my progress |
| POST | `/challenges/:id/join` | Join |
| POST | `/challenges/:id/claim` | Claim reward |
| POST | `/friends/:userId` | Add friend (via invite code) |

Document everything in `docs/openapi.yaml`; generate the Flutter client models from it if desired.

---

## 9. Screens (Flutter)

| # | Screen | Key elements |
|---|---|---|
| 1 | Onboarding | 3 slides explaining tokens, breaks, rewards; set daily goal |
| 2 | Login / Signup | Email, Google |
| 3 | **Dashboard** | Token balance, goal progress ring, streak flame, "Start Focus" CTA, active challenge card |
| 4 | **Focus Mode** | Large timer, presets (25/45/60), calm visuals, "tokens earning" counter, end/abandon |
| 5 | Session Complete | Tokens earned animation, bonus breakdown, "Take a mindful break" CTA |
| 6 | **Mindful Break** | Guided breathing animation / stretch cards / eye-rest 20-20-20 timer |
| 7 | **Rewards Hub** | Tabs: Avatar Store, Donations, Inventory; price tags in tokens |
| 8 | Avatar Editor | Equip owned items, preview |
| 9 | **Leaderboard & Challenges** | Weekly rank, friends tab, challenge progress bars |
| 10 | Insights | Weekly focus chart, screen-time trend, token history |
| 11 | Profile & Settings | Goals, reminders, notification prefs, logout |

**Design direction:** clean, calm, low-stimulation UI (the app shouldn't itself be a distraction). Soft palette, generous whitespace, light/dark themes, satisfying but brief reward animations (Lottie / Rive).

---

## 10. Notifications (FCM)

| Trigger | Message |
|---|---|
| 50 min continuous app use reported / long session | "Time for a mindful break? +5 tokens" |
| 8 PM, goal not met | "30 more focus minutes keeps your 6-day streak alive 🔥" |
| Challenge ends in 24 h | "You're 80% through 'Focus Five' — finish strong" |
| Weekly rollover | "You ranked #4 among friends this week" |

Respect quiet hours and let users mute categories.

---

## 11. Screen-Time Tracking Strategy

Platform limits matter — plan for it explicitly:
| Platform | Approach |
|---|---|
| Web | In-app focus sessions only; `visibilitychange` for interruptions. Screen time entered manually. |
| Android | MVP: manual entry. Post-MVP: `UsageStatsManager` via a platform channel (requires *Usage Access* permission). |
| iOS | Screen Time API (FamilyControls / DeviceActivity) needs special entitlement — treat as post-MVP; manual entry for MVP. |

The economy is built around **focus sessions** (fully measurable in-app), with screen-time as a secondary signal — this keeps the MVP achievable on every platform.

---

## 12. Security & Privacy
- Passwords hashed with bcrypt/argon2; JWT access (15 min) + rotating refresh (30 days, stored hashed).
- Helmet, CORS allow-list, rate limiting (`express-rate-limit`) on auth and session endpoints.
- Input validation on every route (Zod).
- Collect minimal data; screen-time data stays aggregated per day. Provide account deletion and data export.
- Secrets in environment variables; `.env.example` committed, `.env` git-ignored.

---

## 13. Testing Plan
| Level | What | Tools |
|---|---|---|
| Unit | Token engine rules, streak logic, level math | Jest (server) |
| Integration | API routes with in-memory Mongo | Supertest + mongodb-memory-server |
| Widget | Key Flutter screens | flutter_test |
| E2E | Signup → focus → earn → redeem flow | Flutter integration_test |
| Beta | 15–30 real users, 2 weeks | Pre/post survey, analytics funnels |

Critical test cases: double-complete a session (must award once), complete with forged duration (must reject), redeem with insufficient balance, streak reset across time zones, daily cap reached.

---

## 14. Development Roadmap (14 weeks — from deck)

| Phase | Weeks | Deliverables |
|---|---|---|
| **1. Research — Problem Analysis** | 1–2 | User survey (screen-time habits), competitor review (Forest, Opal, Freedom, Digital Wellbeing), personas, final feature list, success metrics |
| **2. Architecture — System Design** | 3–4 | This blueprint finalized, Figma wireframes + UI kit, OpenAPI spec, DB schema, repo + CI setup, deploy "hello world" for API and Flutter web |
| **3. Development — Core Modules** | 5–8 | W5: Auth (email + Google), user profile. W6: Dashboard + Goals. W7: Focus Mode + session API + interruption tracking. W8: Mindful Breaks, history/insights, FCM setup |
| **4. Economy — Token System** | 9–11 | W9: Token engine + ledger + earn rules + tests. W10: Rewards Hub, avatar editor, donations, streaks + jobs. W11: Leaderboards, challenges, anti-abuse caps, balance tuning |
| **5. Beta Test — Feedback Loop** | 12–13 | Release to testers (Firebase App Distribution / web link), collect analytics + surveys, fix bugs, tune token values |
| **6. Launch — Deployment** | 14 | Production deploy (API, DB, web), Play Store internal/closed track, final demo, report & presentation |

### Suggested team split (adjust to team size)
- **Frontend (1–2):** Flutter screens, state, animations
- **Backend (1–2):** Express API, auth, sessions, jobs
- **Token/Economy owner (1):** engine rules, balancing, tests
- **PM/QA/Design (1):** wireframes, beta program, docs, metrics

---

## 15. Getting Started (Week 3 checklist)

1. Create GitHub repo with the structure in §5; add branch protection and PR template.
2. **Server**
   ```bash
   mkdir server && cd server && npm init -y
   npm i express mongoose zod jsonwebtoken bcrypt helmet cors express-rate-limit dotenv node-cron firebase-admin google-auth-library
   npm i -D typescript ts-node-dev @types/express @types/node jest ts-jest supertest mongodb-memory-server
   ```
3. **App**
   ```bash
   flutter create app --platforms=web,android,ios
   ```
   Then add packages: `flutter_riverpod`, `go_router`, `dio`, `hive_flutter`, `fl_chart`, `firebase_core`, `firebase_messaging`, `google_sign_in`, `lottie`.
4. Create MongoDB Atlas free cluster (replica set → transactions work) and a Firebase project.
5. Add `.env.example`: `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `FIREBASE_SERVICE_ACCOUNT`, `DAILY_EARN_CAP`.
6. Seed rewards catalog and 3 sample challenges (`server/seed/`).
7. GitHub Actions: `npm test` + `flutter analyze && flutter test` on PRs.

---

## 16. Definition of Done (Launch)
- [ ] A new user can sign up, set a goal, complete a focus session, earn tokens, take a break, and redeem an avatar item — on web and Android.
- [ ] Token ledger balances reconcile with `tokenBalance` for every user.
- [ ] Streaks, leaderboards and challenges roll over correctly via scheduled jobs.
- [ ] Push notifications delivered on Android and web.
- [ ] Unit test coverage ≥ 80% on the token engine.
- [ ] Beta feedback collected and top issues resolved.
- [ ] API and web app deployed; README explains local setup.
