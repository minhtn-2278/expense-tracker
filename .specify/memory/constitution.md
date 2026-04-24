<!--
SYNC IMPACT REPORT
Version change: 1.0.0 → 1.1.0 (MINOR — new principle added, stale reference repaired)
Modified principles:
  IV. Supabase Best Practices — wording tightened: RLS verification is now
      documented as the manual checklist in supabase/RLS-VERIFY.md (replaces
      the earlier "tests that query as user A" line, which was superseded
      when the automated RLS suite was dropped in Phase 2).
Added principles:
  VI. Test-Driven Development (NON-NEGOTIABLE)
Added sections: none
Removed sections: none
Templates requiring updates:
  ✅ .specify/templates/tasks-template.md — already carries "Write tests
     FIRST, ensure they FAIL before implementation" language; the new
     principle upgrades that from "if included" to "always required" for
     new feature + bug-fix work.
  ✅ .specify/templates/plan-template.md — Constitution Check gate is
     generic and re-reads the current file; no edit needed.
  ✅ .specify/templates/spec-template.md — no constitution-dependent
     content.
  ✅ CLAUDE.md — already defers to the current plan; no change.
Follow-up TODOs:
  - specs/001-expense-tracker: Phases 1–3 were authored test-after (pre-TDD
    era) and are explicitly grandfathered — backfill tests only when
    modifying that code. Phase 4 (US2 Dashboard), Phase 5 (US3 Search/
    Export), and Phase 6 (Polish) MUST follow TDD. If you re-run
    /speckit.tasks for those phases, ensure test tasks precede their
    implementation counterparts within each story.
-->

# Expense Tracker Constitution

## Core Principles

### I. Clean & Concise Code

Code MUST be readable before it is clever. Every function, component, and module SHOULD
do one thing and be named for that thing. Prefer early returns over nested conditionals;
prefer composition over inheritance; prefer deleting dead code over commenting it out.
Functions over 40 lines or files over 300 lines MUST be justified or split.

Comments explain *why*, never *what* — self-documenting identifiers replace "what" comments.
No `console.log`, no TODO comments without an owner and a follow-up reference, no dead
imports, no unused exports in committed code. Formatter and linter output MUST be clean on
every commit (no warnings ignored without an inline rationale).

Rationale: This is a small, long-lived personal-finance product. Clarity keeps changes
cheap; cleverness compounds cost.

### II. Clear Source Organization

The repository MUST be organized by feature, not by technical layer. Related code —
UI, server actions, data access, and validation schemas — lives near the feature it
serves. Shared primitives live in clearly labelled `lib/`, `ui/`, or `types/`
directories; they MUST NOT know about any feature.

Folder boundaries MUST be enforceable at a glance:

- `app/` — route segments only (pages, layouts, loading/error boundaries, route handlers).
- `features/<feature>/` — feature-scoped components, server actions, hooks, and schemas.
- `lib/` — cross-feature utilities with zero product knowledge (date helpers, formatters,
  the Supabase client factories).
- `lib/supabase/` — server, browser, and service-role client factories.
- `types/` — generated Supabase types and shared TypeScript contracts.

Cross-feature imports between `features/a/` and `features/b/` are forbidden. If two
features need the same thing, it MUST be lifted into `lib/` or `ui/` first.

Rationale: A feature-first layout makes the cost of adding or deleting a capability
visible in one directory and prevents the "utils.ts swamp" that kills small codebases.

### III. Next.js Best Practices (App Router First)

The App Router is the default. Every new route MUST be a React Server Component unless
it owns interactive state, browser-only APIs, or event handlers — and then only the
interactive subtree is marked `"use client"`. `"use client"` MUST sit at the lowest
component in the tree that needs it, never at a page or layout.

Mutations MUST go through Server Actions or Route Handlers — never direct client-side
writes. Data fetching for server-rendered pages MUST happen in Server Components or
Server Actions and MUST NOT ship secrets to the client. `loading.tsx`, `error.tsx`, and
`not-found.tsx` MUST be provided for every route segment that can fail or wait.

Images MUST use `next/image`; fonts MUST use `next/font`; metadata MUST use the
`metadata` export. Client-side navigation MUST use `next/link`. Environment variables
that are read in the browser MUST be prefixed `NEXT_PUBLIC_`; every non-prefixed variable
MUST NOT be referenced from a `"use client"` file.

Rationale: The App Router's server-first model is the whole reason to use Next.js for
this product; violating it re-introduces the problems it was built to solve.

### IV. Supabase Best Practices (RLS is Non-Negotiable)

Row-Level Security MUST be enabled on every table that holds user data, and every table
MUST have explicit policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` before a
feature ships. A table without a policy denies by default — this is intentional; no PR
may merge that relaxes RLS to "make it work."

The Supabase **service-role key** MUST NEVER appear in a client bundle, a client
component, a public environment variable, or a browser-visible network call. It lives
only in server-only modules (Route Handlers, Server Actions, scripts). Client code uses
the anon key + the user session and relies on RLS for authorization.

Database changes MUST be made through versioned migrations checked into the repository.
TypeScript types for the database MUST be generated from the schema and committed;
hand-written types for database rows are forbidden. Authorization MUST be enforced at
the database layer (RLS) first; server-side checks are a second line of defence, never
the only one.

Verifying that RLS policies are written correctly is done per the manual checklist at
`supabase/RLS-VERIFY.md`. Any PR that touches `supabase/migrations/**` or a table's
RLS configuration MUST run that checklist before merge and record the verification in
the PR description.

Rationale: Supabase's security model *is* RLS. Every exception to it is a data-breach
waiting for production traffic.

### V. Type Safety & Validation at Boundaries

TypeScript MUST be configured in strict mode (`strict: true`, `noUncheckedIndexedAccess:
true`). `any` is forbidden in committed code; `unknown` + narrowing is the correct
escape hatch. Types MUST be derived from schemas, not duplicated alongside them.

Every input that crosses a trust boundary — form submissions, Server Action arguments,
Route Handler request bodies, URL search params, webhook payloads — MUST be validated
with a schema library (e.g. Zod) before use. The validated, typed value is what the rest
of the code sees; the raw input is discarded at the boundary.

Rationale: Validation at the edge gives us one place to reason about untrusted data and
one shape to consume throughout the app, which keeps business logic small and correct.

### VI. Test-Driven Development (NON-NEGOTIABLE)

Production code MUST be written through the Red-Green-Refactor cycle:

1. **Red** — write a failing test that expresses the desired behaviour, and run the
   suite to confirm it fails for the right reason (the assertion, not a missing file,
   import typo, or compile error).
2. **Green** — write the minimum production code that flips the new test to passing,
   and run the full suite to confirm nothing else regressed.
3. **Refactor** — tighten names, remove duplication, improve structure while the suite
   stays green; add further tests for edge cases the refactor exposes.

**New functional requirements** ship with at least one test written BEFORE the
implementation and committed in the same logical step (ideally the same commit; at
minimum the same PR). **Bug fixes** ship with a regression test written BEFORE the
fix — the test MUST fail against the broken code, and the PR description MUST state
which test reproduces the bug.

**Exempt from strict TDD** (write tests if valuable, not required up-front):

- Pure UI tweaks with no new logic (colour, spacing, copy, reordering).
- Configuration-file changes (`tsconfig`, `eslint.config`, `package.json`
  scripts, `next.config`).
- Dependency version bumps.
- Exploratory spikes explicitly labelled "throwaway" in the commit message.
- Migrations + RLS policies — these are verified by the checklist in
  `supabase/RLS-VERIFY.md`, not by automated tests. The application-layer code
  consuming them still follows TDD.

**Grandfathering**: code that shipped before this principle was ratified
(specifically, Phases 1–3 of feature `001-expense-tracker`) is exempt from
retroactive test-first discipline. Backfill tests incrementally as that code is
modified; do not halt feature work to rewrite history.

**Enforcement**: PR reviewers MUST ask, for any new feature commit: "where is the test
that failed before this line existed?" If the author cannot point to one (or cite an
exemption), the PR is blocked. CI MUST run the full test suite on every PR; a failing
suite blocks merge.

Rationale: Writing the test first forces the interface to be designed from the
caller's perspective before implementation details lock it in; it bounds how much
code is written at a time, which aligns with the "no half-finished implementations"
rule in §I; and it guarantees a regression net that grows with the codebase rather
than being a separate later project that never lands.

## Technology & Security Constraints

- **Stack lock**: Next.js (App Router) + Supabase (Postgres, Auth, RLS) + TypeScript.
  Adding another runtime, database, or auth provider requires a constitution amendment.
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY`, database URLs, and any third-party secrets
  live in server-only env vars. They MUST NEVER be imported from a `"use client"` file
  and MUST NEVER be prefixed `NEXT_PUBLIC_`.
- **Authentication**: User auth is Supabase Auth. Sessions are read server-side through
  the Supabase server client; no hand-rolled session handling.
- **Authorization**: Row-Level Security is the source of truth. Server-side checks
  (e.g. "is this the owner?") may exist for early failure or better errors but MUST
  NOT be the only gate.
- **Data privacy**: No user's data may be readable, writable, or exportable by any
  other user. This is enforced by RLS and verified by the manual checklist at
  `supabase/RLS-VERIFY.md` (decision rationale in
  `specs/001-expense-tracker/research.md §8`).
- **Dependencies**: New runtime dependencies require a short justification in the PR
  description. Dev-only tooling (formatter, linter, test runner) is exempt.

## Development Workflow

- **Branches**: One feature per branch; branch name matches the `specs/NNN-<slug>/`
  directory for that feature.
- **Specs-first**: Non-trivial work follows the Spec Kit flow — `/speckit.specify` →
  `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`. Drive-by changes outside a
  spec are allowed only for bug fixes and pure refactors.
- **Tests-first inside each feature**: per Principle VI, within a user-story phase
  the test task MUST precede its implementation task. If `/speckit.tasks` produces
  a list where implementation tasks appear before their tests, reorder before running
  `/speckit.implement`.
- **Code review**: Every change lands via PR. A PR MUST state (1) what it changes, (2)
  the constitution principles it touches, (3) how RLS is preserved if data access
  is affected, and (4) for non-exempt changes, which commit or line-range contains
  the test that failed before the change.
- **Quality gates before merge**: the formatter passes, the linter passes with zero
  warnings, `tsc --noEmit` passes, the full unit/integration test suite passes, the
  Playwright E2E suite passes for affected stories, and any new table has a migration
  plus RLS policies in the same PR.
- **Schema changes**: every schema change is a migration file committed with the PR
  that uses it. Regenerated Supabase types are committed in the same PR.
- **Secrets in logs**: logs MUST NOT contain tokens, service-role keys, password hashes,
  or full request bodies of auth endpoints. Violations are treated as bugs, not
  conveniences.

## Governance

This constitution supersedes ad-hoc conventions. When it conflicts with a code review
comment, a README, or a habit, the constitution wins — and the other document MUST be
updated or deleted in the same PR that exposed the conflict.

**Amendment procedure**: any change to this file is a PR that (1) edits
`.specify/memory/constitution.md`, (2) updates the Sync Impact Report comment at the
top, (3) bumps the version according to the rules below, and (4) updates or flags any
affected templates in `.specify/templates/`.

**Versioning policy** (semantic versioning for governance):

- **MAJOR**: a principle is removed, inverted, or materially narrowed in a way that
  invalidates existing code (e.g. dropping RLS, replacing Next.js).
- **MINOR**: a new principle or section is added, or existing guidance is expanded with
  new MUSTs.
- **PATCH**: wording, typo, clarification, or rationale edits that do not change what
  the document requires.

**Compliance review**: every PR review MUST treat a violation of a MUST clause as a
blocking issue. Complexity that appears to violate a principle (e.g. a `"use client"`
page, raw SQL without RLS context, an untyped boundary, an implementation commit
without a preceding test commit) MUST be called out and either justified in the PR
description or removed.

**Runtime guidance**: day-to-day development guidance for AI assistants and humans
lives in `CLAUDE.md` and in the current feature's `specs/NNN-*/plan.md`; neither may
contradict this constitution.

**Version**: 1.1.0 | **Ratified**: 2026-04-23 | **Last Amended**: 2026-04-24
