# CLAUDE.md — Project Context & Workflow

## Project

**MAJIDA Beauté Center** — a CRM/management system for a beauty clinic. Full requirements are in [docs/SRS.md](docs/SRS.md). Key points to keep in mind on every task:

- **Domain**: client management & segmentation, client profiles/history, appointment calendar with automated WhatsApp reminders, post-treatment follow-ups, WhatsApp campaigns, digital-signature consent forms, a marketing landing page, and brand identity (see SRS Appendix א׳).
- **UI language**: the entire interface is in **Hebrew, RTL, mobile-responsive**. Always use the `hebrew-ui` skill when building or reviewing any UI.
- **External integrations** (per SRS §12.2): WhatsApp Business Platform (Cloud API or BSP), an Israeli SMS provider (fallback + OTP), an email service (e.g. SendGrid) for daily admin reports and signed-form PDFs, encrypted file storage (S3 or equivalent) for images/PDFs. Google Calendar sync is phase 3, not MVP.
- **Phasing**: SRS §13 defines 3 phases — phase 1 (MVP) is clients/segments, profile/history, calendar+WhatsApp reminders, follow-ups, consent forms, WhatsApp campaigns, landing page. Phase 2 adds WhatsApp inbox, before/after photos, self-service booking, reports. Phase 3 adds Google Calendar sync, birthday greetings, SMS/email campaigns, multi-language forms, multi-branch support.
- **Security/privacy**: see SRS §11 — handle client PII, consent signatures, and treatment history accordingly; never expose secrets or real credentials in code or config.

## Tech Stack

- **Frontend**: Next.js + shadcn/ui (Tailwind-based components). Use the `shadcn` skill for component work, `frontend-design` and `ui-ux-pro-max` for visual/UX decisions, and `gsap-*` skills if/when animation is needed.
- **Deployment**: **Vercel**. The `deployer` agent is Vercel-specific — keep it that way unless this changes.
- Backend/database/auth are not yet decided — `planner` should propose and document these in `PLAN.md` when planning the first feature slice, consistent with the integrations listed above.

## Subagents

Five dedicated subagents are defined in `.claude/agents/`:

1. **planner** — Plans the application/feature and creates or updates `PLAN.md`. Does not write implementation code.
2. **coder** — Implements **one task** from `PLAN.md` per run, and marks it `[x]` when done.
3. **tester** — Writes tests for what was implemented, runs them, and reports what passed and what failed. Does not fix code itself.
4. **deployer** — Prepares the project for deployment to Vercel (build, configuration, environment variables). Does not actually deploy without explicit approval.
5. **manager** — Orchestrates the other four. Invoke it when you want the coder→tester loop (and optionally deployer) to run across several tasks or the whole plan without manually invoking each subagent yourself. It still stops for approval at planning, open PLAN.md decisions, and anything outward-facing/irreversible.

## Standard workflow

```
planner  →  PLAN.md
   │
   ▼
coder (task 1) → tester → (if failed) → coder fixes → tester
   │ (if passed)
   ▼
coder (task 2) → tester → ...
   │
   ▼
... until all tasks in PLAN.md are marked [x]
   │
   ▼
deployer → deployment readiness report → (user approval) → actual deployment
```

### Rules
- **Always start with `planner`** when there's a new requirement (new app, new feature, architectural change) — before writing any code. Planner should ground tasks in `docs/SRS.md` and note any open questions from SRS §13.2.
- `coder` operates on **one task only** per invocation, in the order given in `PLAN.md` (or on a task explicitly specified to it). All UI work must follow the `hebrew-ui` skill (Hebrew text, RTL layout, mobile-responsive).
- After every task (or group of related tasks) implemented by `coder`, run `tester` to verify the code works and hasn't broken anything existing.
- If `tester` reports failures — go back to `coder` to fix them, then back to `tester`, until tests pass.
- Once all of `PLAN.md` is marked `[x]` (or the relevant portion for release) and tests are green — run `deployer` to prepare the deployment to Vercel.
- `deployer` **does not perform an actual deployment** (`vercel --prod`, etc.) without explicit user approval in the conversation.
- `PLAN.md` is the single source of truth for tasks — every agent reads it before starting work, and only `planner` and `coder` update it (planner updates the plan, coder updates the `[x]` marks).
- Treat client PII, signed consent forms, and treatment history as sensitive data per SRS §11 — never log, display, or commit real client data or secrets.

## Invoking the agents

You can invoke each agent directly using the Agent tool with the matching `subagent_type` (`planner` / `coder` / `tester` / `deployer`), or simply ask Claude in free text, e.g. "run the planner".
