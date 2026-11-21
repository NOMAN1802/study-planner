# Habit Tracker + Task Manager — Project Plan

## How to use this file

- Work one phase at a time, top to bottom.
- Tick a checkbox only when the item is built AND its tests pass.
- A phase is complete only when its "Gate" passes. Do not start the next phase before that.
- After each phase, add a short entry to the Progress Log at the bottom.

## 1. Goal

A personal web app to build habits and manage time: dynamic habits (hourly, daily,
weekly, monthly), tasks with time targets and notes, a configurable pomodoro timer
per task, a time planner, and an interactive animated dashboard.

## 2. Stack

- Next.js (latest stable, App Router, TypeScript strict), Tailwind CSS
- Prisma ORM on Supabase Postgres
- Supabase Auth (email + password)
- Zod validation, Server Actions for mutations
- Motion (Framer Motion) for animation, Recharts for charts, Lucide icons
- Vitest + React Testing Library (unit/component), Playwright (end-to-end)

## 3. Environment

`.env` (never committed, never printed in logs or output):

```
DATABASE_URL=   # pooled, port 6543, ?pgbouncer=true  (app runtime)
DIRECT_URL=     # port 5432                            (migrations)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- `schema.prisma`: `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")`
- Special characters in the DB password must be URL-encoded (`@` becomes `%40`).
- Keep `.env.example` with placeholders only.

## 4. Data model

| Model           | Key fields                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Profile         | id (= Supabase auth user id), timezone, weekStartsOn                                                                             |
| Habit           | name, note, color, icon, frequency (HOURLY/DAILY/WEEKLY/MONTHLY), targetCount, targetMinutes, activeHours, sortOrder, archivedAt |
| HabitLog        | habitId, periodStart, count, minutes, note                                                                                       |
| Task            | title, note, status (TODO/IN_PROGRESS/DONE), priority, dueAt, targetMinutes, actualMinutes, habitId?                             |
| PomodoroConfig  | taskId (unique), focusMinutes, shortBreakMinutes, longBreakMinutes, cyclesBeforeLongBreak, autoStartNext                         |
| PomodoroSession | taskId, type (FOCUS/SHORT_BREAK/LONG_BREAK), startedAt, endedAt, completed                                                       |
| TimeBlock       | startAt, endAt, taskId?, habitId?                                                                                                |

Rules:

- Every row has `userId`; every query is scoped to the logged-in user.
- Store all times in UTC. Compute periods and streaks in the user's timezone.
- Unique constraint on HabitLog (habitId, periodStart).

## 5. Folder structure

```
src/
  app/
    (auth)/login, signup
    (app)/dashboard, habits, tasks, planner, settings
  components/        ui/, habits/, tasks/, pomodoro/, planner/, dashboard/
  lib/               prisma.ts, supabase/, dates.ts, streaks.ts, pomodoro.ts
  actions/           habits.ts, tasks.ts, pomodoro.ts, planner.ts
  schemas/           zod schemas
prisma/              schema.prisma, migrations/
tests/               unit/, components/, e2e/
```

## 6. Design rules (must not look AI-generated)

- No purple/blue gradients, glassmorphism, glowing blobs, or emoji used as icons.
- No generic three-card hero layouts or centered-everything pages.
- Neutral palette + one accent color. One display font, one text font. 4px spacing scale.
- Tool-like layout: sidebar navigation, dense lists and tables, clear hierarchy.
- Every screen has designed empty, loading, and error states.
- Light and dark mode. Fully usable at 375px width.

## 7. Animation rules

- Motion must explain a change: check-in, progress fill, reorder, timer transition, section entrance.
- 150–300ms, ease-out. No looping decorative animation.
- Respect `prefers-reduced-motion`.

## 8. Testing rules

- Tests are written with each feature, not afterward.
- Gate command for every phase: `lint` + `typecheck` + unit tests + e2e tests, all green.
- If a test fails, fix the code (not the test) unless the test itself is wrong, and say which.

---

## Phase 1 — Foundation and auth

- [x] Create Next.js project with TypeScript strict, Tailwind, ESLint, Prettier
- [x] Install and configure Prisma; write full schema; run first migration
- [x] Supabase Auth: signup, login, logout, protected routes, Profile row on first login
- [x] App shell: sidebar, top bar, theme toggle
- [x] Configure Vitest, React Testing Library, Playwright
- [x] Tests: auth e2e (signup, login, redirect when logged out)

**Gate:** user can sign up and reach an empty dashboard; all checks green.

## Phase 2 — Habits

- [x] Create, edit, reorder, archive habits
- [x] Frequency support: hourly (with active hours), daily, weekly, monthly
- [x] Targets per period: count and/or minutes; notes
- [x] Check-in per period with optional note
- [x] `lib/dates.ts`: period boundaries in user timezone
- [x] `lib/streaks.ts`: current streak, best streak, completion rate
- [x] Tests: unit (period boundaries, streaks, timezone edges, week start), component (habit form), e2e (create and check in)

**Gate:** streak numbers are correct across day, week, and month boundaries.

## Phase 3 — Tasks

- [x] Task CRUD: title, note, priority, status, due date, target minutes
- [x] Optional link to a habit
- [x] Filters (status, priority, due) and sorting
- [x] Tests: component (task form validation), e2e (create, edit, complete, delete)

**Gate:** full task lifecycle passes e2e.

## Phase 4 — Pomodoro

- [x] Per-task config: focus, short break, long break, cycles, auto-start
- [x] `lib/pomodoro.ts`: state machine (idle, focus, break, paused, done)
- [x] Remaining time computed from timestamps, not tick counting
- [x] Start, pause, resume, skip; state survives refresh and background tabs
- [x] Save sessions; add focus minutes to task `actualMinutes` and linked habit
- [x] Optional sound and browser notification at phase end
- [x] Tests: unit (state machine, time math with fake timers), component (controls), e2e (short session updates task)

**Gate:** timer stays accurate after reload mid-session.

## Phase 5 — Planner

- [x] Day view with hourly slots
- [x] Week view and month view
- [x] Drag task or habit into a slot to create a TimeBlock; resize and move blocks
- [x] Overlap handling
- [x] Tests: unit (overlap, slot math), e2e (create block, reload, block persists)

**Gate:** blocks save and render correctly in all three views.

## Phase 6 — Dashboard

- [x] Today panel: habits due, tasks due, quick check-in
- [x] Progress rings for daily targets
- [x] Streak list and year heatmap
- [x] Focus minutes chart (day / week / month toggle)
- [x] Target vs. actual time per task
- [x] Tests: unit (aggregation queries), e2e (dashboard numbers match seeded data)

**Gate:** every dashboard number is verified against known seed data.

## Phase 7 — Design and motion polish

- [x] Apply design rules (section 6) to every screen
- [x] Add animations per section 7
- [x] Empty, loading, error states everywhere
- [x] Mobile layout at 375px; keyboard navigation; visible focus states
- [x] Tests: accessibility checks in Playwright, reduced-motion check

**Gate:** no accessibility violations; app works with keyboard only.

## Phase 8 — Ship

- [x] Full test run on a production build
- [x] Seed script for demo data
- [x] README: setup, env vars, scripts
- [x] Deploy notes for Vercel (env vars, `prisma migrate deploy`)

**Gate:** production build runs clean and all tests pass against it.

## Phase 9 — Work-Station (BCS study + office routine)

- [x] Weekly routine: office 09:00–18:00 Sat–Thu, Friday off; study 05:20–08:20 + 19:00–23:00 (7 cycles), Friday 14 cycles; 56 a week; editable slots with overlap checks
- [x] 1 study cycle = 1 hour; no study timer (since 2026-11-21): each item of the day is ticked done by hand (see Phase 11, "Study without a timer"); older timer sessions still count
- [x] BCS syllabus from `Doc/study-resource` (9 subjects, 164 lectures + daily vocabulary), hardest first, reorderable
- [x] Rolling 100-day plan (default 80 learning + 20 revision since 2026-11-17; start day and lengths editable on the Plan tab): daily vocabulary, Friday weekly revision + exam, subject revision + final after each subject, revision with mock tests every 2nd day; buffer/behind and projected dates
- [x] Exams: record weekly / subject final / mock scores; upcoming exams from the plan
- [x] Office task list (task category OFFICE), shown in Tasks with an Office tag
- [x] Dashboard study card (today and week cycles)
- [x] Tests: unit (routine, schedule, schemas), component (routine editor, setup form), e2e (setup → lecture → cycle → office task → exam; axe on every tab in both themes)

**Gate:** all checks green on a production build.

---

## Phase 10 — Lighter study days

- [x] At most 2 lectures a day; 4 lectures on Fridays and holidays (later 3, below); the cap also applies to lectures that spill into the revision phase. Since 2026-11-21 the cap counts lectures, not cycles, so lectures with little time left no longer let a third one onto an office day
- [x] Holidays (e.g. govt holidays 16 Dec, 25 Dec) are a per-plan list (`StudyPlan.holidays`, migration `plan_holidays`), edited on the Plan tab; a holiday follows the Friday routine (evening before + Friday daytime) but has no weekly revision/exam
- [x] The rest of each day's study session (7 cycles, 14 on Fridays/holidays) revises the subject being covered; this is where the daily exam will sit (Phase 11)
- [x] A subject's revision + final exam get a day of their own: no lectures, no revision blocks, the rest of the day free
- [x] Study days start at 18:00 the evening before (like the Islamic day): a study day = the previous evening's session + its own morning (Friday = Thursday evening + Friday daytime); "today", cycle counts, vocabulary days and the Today timeline follow it; habits, tasks and planner keep calendar days
- [x] Buffer shown in days (projected vs planned learning end) instead of cycles
- [x] Subjects tab: day-by-day routine per subject (lectures, revision, final day, later revision blocks); plan start day editable
- [x] Lectures merged following `Doc/New Routine .pdf` (one lecture per routine class; self study, Q-solve and open-book rows ignored): 164 videos → 134 lectures (+ vocabulary 8 → 2), each lecture keeps its original videos as Part 1, Part 2… links (`Topic.parts`, migration `topic_parts`); at 2 lectures a day the syllabus finishes ~11 days inside the 80 learning days from an 18 Nov start
- [x] One lecture per video: 164 lectures (+ vocabulary 2 marathons), titled as in `Doc/study-resource`, ordered within each subject by the routine's classes; 2 lectures a day on every day, Fridays and holidays included (the rest of Friday is revision + weekly exam). From a 20 Nov start the lectures and 9 subject final days take 93 days (20 Nov → 20 Feb)
- [x] Revision by subject (`REVISION_PLAN`): English 3 days, Bangla 2, Math + Mental 3, International 2, Bangladesh Affairs 2, Science 1, ICT 1, Geography + Morality 1 (shared) = 15 days, whole days per subject, no mock tests; days past the plan fall back to rotating revision with mocks. New plans default to 93 learning + 15 revision days (108 days, 20 Nov → 7 Mar)
- [x] 3 lectures on every Friday and holiday (holidays 16 Dec, 25 Dec, 24 Jan), 2 on office days: lectures + finals take 87 days (20 Nov → 14 Feb), revision 15 Feb → 1 Mar (102 days); new plans default to 87 + 15
- [x] Tests: unit (caps per weekday/holiday, revision fill, final day, holidays, study-day boundary, buffer days, real syllabus), e2e (edit start day, add holiday)

**Gate:** all checks green on a production build.

---

## Phase 11 — Question-bank exams (BCS Preliminary standard)

Questions come from the user's topic-wise question-bank PDFs in `Doc/study-resource`. Claude converts each PDF (question, 4 options, correct answer, source) and links every question to its lecture (`Topic`); questions are loaded into the database per subject. New PDFs go through Claude again.

| Exam | Questions | Time | Drawn from |
|---|---|---|---|
| Daily | 20 | 15 min | lectures covered that day |
| Weekly (Friday) | 50 | 30 min | lectures covered that week |
| Subject final | 100 | 60 min | all lectures of the subject |

- [x] Question bank: transcribed files in `Doc/question-bank/*.json` (git-ignored: copied from books, and the repo is public), one subject per file, sections linked to a lecture title; `pnpm db:questions <file…>` validates and upserts into `Question` (id `<section>-<n>`, migration `question_bank`); `ownerId` null = shared bank, set = private (e2e). First bank: English Literature, 194 questions (Literary Terms → Lit 01; Old & Middle English, Renaissance, Preparation for the Renaissance → Lit 02; Elizabethan, Spenser → Lit 03)
- [x] Marking: +1 correct, −0.50 wrong, 0 unanswered; negative totals allowed
- [x] "Covered" = lectures ticked done (daily: today's study day; weekly: this week); subject final = every lecture of the subject; questions not yet seen first, then ones answered wrong or left blank last time, then the rest
- [x] Taken in the app (`/work-station/exam/[id]`): countdown from the server deadline, A–D options, answers kept in the browser across reloads, confirm before submitting blanks, auto-submit at time-out (2-min grace for late sheets), instant marking with right answers and explanations; score saved to Exams and linked to the review
- [x] Exams tab: start daily / weekly / subject final with the question count; one exam at a time (an unfinished exam is offered again; one past its time is marked as it stands); manual entry kept for exams taken elsewhere; in-progress exams don't count as done for the plan
- [x] Open questions settled: an exam with fewer questions in the bank than its size asks what there is; with none (e.g. no lecture ticked today) it can't start
- [x] Tests: unit (marking, selection order, history, coverage, bank files incl. the real bank), component (countdown, answers kept, confirm, auto-submit), e2e (sit a daily exam, reload, submit, review, recorded)
- [x] Topic-wise exams: the daily / weekly exam is taken on topics you pick from the lectures ticked done (only lectures with questions), pre-ticked with today's / this week's; subject finals still cover the whole subject
- [x] Practice exams (`/work-station/practice`): any topics in the bank, 10 / 20 / 50 questions, no timer, each answer checked at once with the explanation, a running tally and an end summary; never saved, so it never reaches Exams or the dashboard
- [x] Dashboard "Exam results" panel (real exams only, incl. results recorded by hand): average % overall and per exam type, recent 5 scores, score trend chart, weak topics (question-bank sections with the lowest share correct, at least 3 asked)
- [x] Tests: unit (exam stats), component (practice feedback and summary), e2e (pick topics, real exam on the dashboard, practice not counted)
- [x] Study without a timer: the Today list is ticked by hand — a lecture when it is ticked done, vocabulary and revision on their own check (`StudyCheck`, migration `study_check`, one row per plan/day/item), exams when a result is recorded; when every item is ticked the day shows "Study session complete". The list is today's plan as it stood in the morning, so ticked items stay on it. Subjects tab has no start-cycle button; a done lecture counts its planned hours (or the timer hours, if more)
- [x] Longer study days: office days 8 cycles (morning 04:35–08:35, commute 08:35–09:00, night 18:45–22:45 after 45 min rest; sleep 22:45–04:15), Friday and holidays 16 (evening before 4 + 04:50–12:50 + 14:30–18:30, then Friday night 18:30–22:30; Jumu'ah & lunch 12:50–14:30), 64 a week; every night at least 5.5 h sleep (unit-tested); lecture caps unchanged, so the extra time goes to revision. Plan setup now runs in one interactive transaction with a 30 s timeout (the pooled connection could pass Prisma's 5 s default)

**Gate:** all checks green on a production build.

---

## Out of scope for v1

Social features, team sharing, native mobile app, AI suggestions, calendar sync.

## Progress log

| Date | Phase | What was done | Tests |
| ---- | ----- | ------------- | ----- |
| 2026-11-15 | 1 | Next.js 16 + TS strict + Tailwind 4 + Prettier; Prisma 7 schema (7 models) and `init` migration on Supabase; email/password auth via Supabase SSR (signup, login, logout, `proxy.ts` route guard, Profile created on first sign-in with browser timezone); app shell with sidebar, top bar, light/dark toggle; Vitest + RTL + Playwright configured; Node pinned to 24 (`.nvmrc`). | lint ✓ typecheck ✓ unit 16/16 ✓ e2e 4/4 ✓ |
| 2026-11-15 | 2 | Habits: create/edit/reorder (up/down, animated)/archive/restore; hourly (active hours), daily, weekly, monthly; count and/or minute targets; +1 check-in and per-period log (count, minutes, note); `lib/dates.ts` (tz-aware period boundaries via @date-fns/tz, DST/half-hour offsets/week start) and `lib/streaks.ts` (current, best, completion rate); Settings page for timezone + week start; app-wide loading/error/not-found states. Fixed: server component importing a client-only helper; reorder could be cancelled by an immediate reload (now shows pending state). Playwright tuned to 2 workers for dev-server compile latency. | lint ✓ typecheck ✓ unit 75/75 ✓ e2e 9/9 ✓ (run twice) |
| 2026-11-15 | 3 | Tasks: create/edit/delete (inline confirm), complete/reopen via checkbox (optimistic, `completedAt` kept), status/priority/due (entered in user's timezone, shown as Today/Tomorrow/date)/target minutes/note, optional link to an owned habit; URL-based filters (status incl. Open, priority, due: overdue/today/this week/none — timezone and week-start aware) and sorting (due nulls-last, priority, newest, title); empty and no-match states. Fixed: filter selects' accessible names included every option (label now a sibling); e2e helper waits for server actions before reload. | lint ✓ typecheck ✓ unit/component 102/102 ✓ e2e 12/12 ✓ (run twice) |
| 2026-11-15 | 4 | Pomodoro: pure state machine in `lib/pomodoro.ts` shared by client and server actions; sessions persisted with start/pause timestamps (server is source of truth, client corrects for clock offset); completion and auto-started phases stamped at the exact scheduled end so background tabs lose no time; one active timer per user; completed focus credits planned minutes (skip credits whole elapsed minutes) to task `actualMinutes` and the linked habit's period log; per-task config; focus page with progress ring, cycle dots, countdown in tab title, session history; per-device sound (Web Audio) and notification toggles. Gate e2e: real 1-min session, reload mid-run (continuity within 1.5s) and while paused, then credit verified on task + habit. | lint ✓ typecheck ✓ unit/component 130/130 ✓ e2e 15/15 ✓ (run twice) |
| 2026-11-15 | 5 | Planner: day/week (hourly grid, DST-aware 23/25h days) and month views via URL (`?view&date`); drag tasks/habits from a palette to create blocks (HTML5 DnD) or pick-then-place (keyboard/touch); pointer move/resize (15-min snap, across days in week), keyboard move/resize/delete, month chip drag between days; overlaps allowed, laid out in lanes and flagged; optimistic updates with ownership-checked server actions. Readable message for auth network failures. | lint ✓ typecheck ✓ unit/component 153/153 ✓ e2e 18/18 ✓ (gate run + re-run; one interim run hit a transient Supabase network failure) |
| 2026-11-16 | 6 | Dashboard: Today panel (habits checkable now with quick check-in, tasks due today + open overdue with complete toggle and focus link); progress rings (daily habits done, tasks due today done, one ring per daily habit, animated arc); streak list sorted by current streak; 53-week heatmap of daily/hourly habits completed per local day (archived habits keep history; weekly/monthly excluded because completion has no single day); focus-minutes bar chart (Recharts) with day/week/month toggle, minutes credited at session end, text equivalent for screen readers; target vs. actual bars per task with over-target flag. Pure aggregation in `lib/dashboard.ts`, queries in `lib/dashboard-server.ts`. Gate e2e seeds known rows straight into Postgres (`tests/e2e/seed.ts`) and checks every number, then re-checks after a quick check-in and a task completion. | lint ✓ typecheck ✓ unit/component 168/168 ✓ e2e 19/19 ✓ |
| 2026-11-16 | 7 | Polish: axe scan of every screen in light and dark drove the fixes — subtle-text, warning and danger-button colours raised to AA contrast, heading levels corrected, planner schedule buttons and grid scroll region given proper names/focus, chart removed from the tab order. Shell: skip link, mobile drawer closes on Escape, moves/returns focus and leaves the tab order when closed, solid header (no blur). Motion: one 220ms staggered section entrance (CSS), ring tween off under reduced motion. States: route-shaped static skeletons for dashboard, planner, focus and form pages; root 404, root error and global error screens; error boundaries use `retry`. | lint ✓ typecheck ✓ unit/component 168/168 ✓ e2e 26/26 ✓ (axe: 0 violations on 20 screens × 2 themes; 375px no overflow; keyboard-only journey; reduced-motion and motion-duration checks) |
| 2026-11-16 | 8 | Ship: `pnpm gate:prod` builds and runs every test against `next start` (port 3100, never reusing a dev server); demo seed `pnpm db:seed <email> [--reset]` fills one existing account (5 habits with ~2 months of history, 6 tasks with focus sessions, 8 planner blocks) from a deterministic, unit-tested generator and refuses to overwrite data without `--reset`; README (setup, env vars, scripts, tests, demo data); Vercel notes in `Doc/deploy.md` (env vars, production-only `prisma migrate deploy` in the build command, Supabase settings, rollback caveat) — written from the code, not yet run on Vercel. Fixed: database pool and e2e seed had no connection timeout, so one connection that never opened hung pages and a test run indefinitely; both now fail after 10–15s. | build ✓ lint ✓ typecheck ✓ unit/component 174/174 ✓ e2e 27/27 ✓ against the production build |
| 2026-11-16 | 9 | Work-Station: weekly routine (office Sat–Thu 09:00–18:00, Friday off; 7/14 study cycles, 56 a week; editable, overlap-checked); BCS syllabus transcribed from `Doc/study-resource` (9 subjects, 164 lectures + daily vocabulary) seeded per user with one 50/10 pomodoro task per subject; pure rolling schedule in `lib/workstation/schedule.ts` (70 learning + 20 revision days, Friday weekly revision + exam, subject final, mock every 2nd revision day, buffer/overflow and projected dates); tabs Today / Plan (90-day roadmap) / Subjects / Exams / Office / Routine; timer sessions record the lecture; `Task.category` (GENERAL/OFFICE/STUDY) with study tasks hidden from Tasks; dashboard study card. Migration `workstation` (additive). | build ✓ lint ✓ typecheck ✓ unit/component 209/209 ✓ e2e 30/30 ✓ against the production build |
| 2026-11-21 | 11 | Study without a timer: Today items ticked by hand (lectures via done, vocabulary/revision via `StudyCheck`, exams via a recorded result), "Study session complete" once all are ticked; start-cycle buttons removed. Lecture cap now counts lectures (2 office days, 3 Fridays/holidays) instead of cycles — part-studied lectures had let 3 onto an office day. `E2E_PORT` overrides the e2e port. | lint ✓ typecheck ✓ unit 272/272 ✓ e2e 31/31 ✓ against the production build |
