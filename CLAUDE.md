<!-- SPECKIT START -->
Active feature: **001-expense-tracker** (Simple Expense Tracker — Next.js App
Router + Supabase).

Read these in order when starting work on this feature:

- [specs/001-expense-tracker/plan.md](specs/001-expense-tracker/plan.md) — tech stack, project structure, constitution check
- [specs/001-expense-tracker/spec.md](specs/001-expense-tracker/spec.md) — user stories, FRs, success criteria, clarifications
- [specs/001-expense-tracker/research.md](specs/001-expense-tracker/research.md) — resolved design decisions
- [specs/001-expense-tracker/data-model.md](specs/001-expense-tracker/data-model.md) — tables, RLS, validation rules
- [specs/001-expense-tracker/contracts/](specs/001-expense-tracker/contracts/) — server-action and route-handler contracts
- [specs/001-expense-tracker/quickstart.md](specs/001-expense-tracker/quickstart.md) — local dev loop and commands
- [.specify/memory/constitution.md](.specify/memory/constitution.md) — non-negotiable principles (RLS, Server Components, Zod at boundaries, strict TS)

Stack at a glance: Next.js 15 (App Router) + React 19 + TypeScript strict,
Supabase (Postgres + Auth + RLS), Zod for boundary validation, Tailwind + shadcn,
date-fns-tz. Vietnamese UI only. VND currency. 30-day rolling session.
<!-- SPECKIT END -->
