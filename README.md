# Grind — Gym, Food & Body tracker (PWA)

An installable Android PWA for tracking workouts (Mon–Sat routine), food (calories, macros and 24 micronutrients) and body composition, with an AI coach (OpenAI or Claude).

## Features

- **Workouts**: a weekly routine by day (Mon–Sat). Add exercises by **typing or speaking** (mic button). Unknown exercises are identified by AI with **web search**, and phrases like _"bench 3×8 at 80"_ log the sets too. Log, edit and delete sets (weight × reps). Each exercise shows the last session, the best set, estimated 1RM, **when it was last updated**, and **when you last lifted the weight you're typing**.
- **AI coach**: looks at the last 8 weeks and gives a trend and next-session target for each exercise, plus weekly sets per muscle and warnings.
- **Food**: describe or speak a meal. AI splits it into items with calories, protein, carbs, fat and 24 vitamins/minerals. You can also search the USDA database or enter food by hand. Targets come from your profile, goal and body scan, with sex-specific reference intakes.
- **Body**: upload a body composition report (InBody etc.). Claude vision reads every value. It then generates a **diet + gym + cardio plan** that covers **how to change each exercise you already do**. You can apply the plan's nutrition targets and/or its weekly split with one tap.
- **Goals**: one active goal (lose fat, build muscle, recomp, strength…). Targets and AI output aim at it.

## Tech

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, TypeScript (strict) |
| API | Versioned route handlers under `/api/v1/*`, Zod-validated input, uniform `{ data } \| { error }` envelope |
| DB / Auth / Files | Supabase Postgres with RLS on every table, Supabase Auth, private Storage bucket |
| AI | Pluggable provider (`src/lib/ai`): OpenAI Responses API (default `gpt-5.4-mini`) or Claude (`claude-opus-5-5`). Zod-validated structured outputs, web search, vision |
| Client data | TanStack Query |
| UI | Tailwind CSS v4, lucide icons, Web Speech API for voice |
| PWA | Web manifest, service worker (offline shell, cached assets), maskable icons |
| Tests | Vitest |

## Folder structure

```
src/
  app/                      # routing only: thin pages + route handlers
    (app)/                  # authenticated screens (bottom-nav layout)
    (auth)/login/
    api/v1/...              # versioned REST API, one folder per resource
    auth/                   # email confirmation callback, sign-out
    manifest.ts
  modules/                  # feature modules (the real code lives here)
    <feature>/
      schemas.ts            # Zod schemas + types (shared by server & client)
      service.ts            # server-only data access & business logic
      hooks.ts              # client TanStack Query hooks
      components/           # feature UI
    workouts/ exercises/ nutrition/ body/ goals/ profile/ coach/ dashboard/
  components/               # shared UI primitives (ui/), layout, voice input
  lib/
    api/                    # route wrapper (auth + validation + errors), typed fetch client
    ai/                     # generateStructured() + providers/ (openai, anthropic)
    supabase/               # browser / server / proxy clients
supabase/
  migrations/               # SQL schema, RLS, storage policies
  seed.sql                  # global exercise library
```

Dependencies only point one way: `app → modules → lib`. A module can use another module's `service`/`schemas`. Server-only files import `server-only`, so they fail the build if a client bundle pulls them in.

## Setup

1. **Install**: `npm install`
2. **Database**
   - Local (Docker): `npm run db:start`. This applies the migrations and the seed. Copy the printed API URL and publishable key.
   - Hosted: create a project at supabase.com, then `npx supabase link --project-ref <ref>` and `npm run db:push`. Run `supabase/seed.sql` in the SQL editor.
3. **Env**: `cp .env.example .env.local` and fill in the Supabase URL/key, an AI key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) and, optionally, a free `USDA_API_KEY`.
4. **Run**: `npm run dev`, then open http://localhost:3000.

### Install on Android

Deploy (e.g. Vercel: set the same env vars) and open the HTTPS URL in Chrome. Then use **⋮ → Install app**. The microphone needs HTTPS, or `localhost`.

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:start`, `db:stop`, `db:reset`, `db:push`, `db:types`, `icons`.

## API (v1)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/v1/exercises` | search library / create exercise |
| POST | `/api/v1/exercises/lookup` | AI + web: text or speech → exercises (+ detected sets) |
| GET | `/api/v1/exercises/:id/history` | sessions, PRs, last time at each weight |
| GET/POST | `/api/v1/routine?weekday=1&date=YYYY-MM-DD` | day plan with stats / add exercise to a day |
| PATCH/DELETE | `/api/v1/routine/:id` | update targets/order, remove |
| POST | `/api/v1/sets` | log one or more sets |
| PATCH/DELETE | `/api/v1/sets/:id` | edit / delete a set |
| GET/POST | `/api/v1/nutrition/logs` | list day / log foods |
| PATCH/DELETE | `/api/v1/nutrition/logs/:id` | edit / delete a food |
| GET | `/api/v1/nutrition/summary?date=` | totals vs targets |
| GET/PUT/DELETE | `/api/v1/nutrition/targets` | get / customise / reset targets |
| GET | `/api/v1/nutrition/foods/search?q=` | USDA search |
| POST | `/api/v1/nutrition/parse` | AI: meal text → itemised nutrition |
| GET/POST | `/api/v1/body-scans` | list / upload report image (multipart `file`) |
| PATCH/DELETE | `/api/v1/body-scans/:id` | correct values / delete |
| GET/POST | `/api/v1/plans` | latest / generate AI plan |
| POST | `/api/v1/plans/:id/apply` | apply nutrition targets and/or training split |
| GET/POST | `/api/v1/coach/insights` | latest / generate workout insights |
| GET/PATCH | `/api/v1/profile` | profile |
| GET/POST, PATCH/DELETE | `/api/v1/goals`, `/api/v1/goals/:id` | goals |

A breaking change to the API ships as `/api/v2/...` next to v1. The handlers are thin, so v2 can reuse the same module services.
