# APEX Loops Engine

The backend now owns durable manual, scheduled and conditional workflows. Existing HUD, humanoid, chat, microphone, personality and selected model/voice configuration are retained. The floating Loops panel opens from the repeat-arrow dock button; hiding it does not stop the worker.

## Start

From `C:\Users\Win11\Documents\ChatGPT\New project\apex`:

```powershell
npm.cmd run build
npm.cmd run launch
```

Open http://127.0.0.1:3000/. Keep the launcher and PC running. Alternatively use two terminals: `npm.cmd run runtime` and `npm.cmd start`. Do not start a second copy on occupied ports. Node 22.13 or newer is required for SQLite. Existing backend environment settings remain in `.env.local`; never put keys in frontend code.

The current selected provider is Ollama, not Gemini. The engine reuses the selected provider/model; preserved Gemini configuration is used only if selected in the existing settings. No provider was changed for this feature.

## Create and control

Choose Create loop, a template, objective, trigger and timezone. Default timezone is Asia/Kuala_Lumpur. Scheduled triggers support a local daily time, interval in minutes, or one date/time. Conditional triggers support changes within the authorised project folder or a local RAM threshold. Manual loops begin Draft. Scheduled/conditional loops activate when saved unless explicitly disabled through the API.

Run now evaluates conditional triggers before executing. Pause stops further steps; Resume retains saved checkpoints. Cancel retains history but ends the workflow. Reminder loops finish only when you select Mark done: a reminder does not prove the underlying task was performed.

Local chat/voice transcripts support:

- Create a loop to every morning at 8, check my assistant services.
- Create a loop to watch this project for new code changes.
- Create a loop to remind me tomorrow until I mark it done.
- Create a loop to research this topic.
- Show my active loops. / List my loops.
- Pause the research loop. / Resume it. / Cancel this loop.
- Run the research loop now.
- What is this loop waiting for?

Commands use strict top-level parsing. Quoted or multiline source instructions do not change settings or grant permissions. Research can wait for supplied sources or a configured search service. Ambiguous loop names request a selection.

## Execution and templates

Chief of staff coordinates the declared steps. Events and connections come from actual backend execution. Each step records observe/evaluate/plan/perform/verify/save progress; history shows execution summaries, never hidden chain-of-thought. All 18 nodes remain in the shared registry, with integration availability reported truthfully.

| Template | Execution | Tools / output |
| --- | --- | --- |
| Services | Engineering → Analytics → Memory | Native system/service diagnostics, local execution metrics, saved report with individual passed/failed/skipped checks |
| Project changes | Developer → Memory | Bounded authorised file reads and selected-model code review; saved draft and provenance |
| Reminder | Ops | Native reminder record; user confirms underlying task completion |
| Research | Researcher → Editor → Memory | Supplied sources or configured Brave search; selected-model summary/editing and saved draft |
| Selected agents | Up to four relevant registry nodes → Memory | Existing role handlers and their declared read tools; native calculations/read operations or selected-model drafts |
| Approved email | Email | Configured Graph sending, exact recipient/subject/message approval, provider acceptance receipt; acceptance is not delivery proof |

The 18-node role/function inventory remains in the existing shared `lib/node-registry.mjs` and agent execution handlers. Loops preserve these responsibilities and do not invent new integrations. Native Analytics/Memory/CRM operations and Finance with supplied figures do not require a model. Text drafts and visual briefs are not published content or generated image assets.

## Persistence and limits

Loop definitions, runs, outputs, API journals, approvals and notices persist in the existing backend SQLite database. Verified outputs have durable checksums. Deterministic Memory records save execution provenance; model drafts are not promoted to confirmed facts.

A backend timer checks due work every 400 ms without a model call. One loop worker runs at a time, independently of the browser. Individual loops cannot overlap. Missed scheduled occurrences coalesce into one run after restart; no backlog burst occurs. The scheduler cannot execute while the PC or backend is off. Project watching polls file hashes: it establishes a baseline, then runs only on observed changes. It skips protected names and symlinks and is bounded to depth six, 500 text files and 200 KB per file. Coverage/truncation evidence is retained.

Limits: at most eight steps per run, 5–300 seconds of active runtime, zero to two retries for idempotent diagnostic failures, and 0–32 total model/search attempts over a loop's lifetime. Calls count before they start, including interrupted attempts. Budget reservations and checkpoints use SQLite transactions. Increasing a paid budget revokes the old budget approval. Recurring workflows eventually wait when their lifetime budget is exhausted.

Recovery resumes verified native checkpoints and reuses journaled returned model outputs. Interrupted model/search requests require explicit reconciliation. Uncertain email delivery never triggers an automatic resend: verify the provider and cancel before creating a new sending attempt. Pause/cancel cannot undo a request already accepted by an external provider.

## Permissions and unavailable services

The creation form declares tools, selected roles and read scope. A step cannot use undeclared tools. Source content is data. Paid Gemini/search usage requires an exact per-loop provider/model/budget approval before the first request. Fish Audio speech is separate and defaults off for loops. Email approval reads back the exact recipient and message; altered payloads require a new approval.

Calendar, Email and Drive need the corresponding existing service credentials/access. Missing connections report Not configured/Unavailable and stop the dependent work. Brave search needs its backend key; without it research needs supplied sources. Code review requires the selected model to be reachable. No credentials were added or exposed. Loops currently support read/review workflows and approved email; deployments, arbitrary shell execution, system setting changes, purchases, social publishing and arbitrary conditional predicates are not implemented loop actions.

Notifications deduplicate and can defer through local quiet hours. Optional spoken updates use the existing selected Fish voice and an at-most-once claim. Speech requires an open, unlocked APEX conversation/voice panel, configured voice service, and an idle voice session. The backend does not make unattended Fish requests with the browser closed. A failed/blocked spoken playback leaves text available. Loop model/search budgets do not include separate Fish usage.

Completed means all declared execution steps returned verified outputs, not that all system checks passed or a draft's factual claims are independently proven. Research citation checks verify links against supplied/search sources; they are not an independent fact-checking service.

## Validation

- Production build and type checking passed.
- 151 automated tests passed, including 19 loop tests: native Finance receipts, recurring/missed schedules, unchanged conditions, project scope, controls/non-overlap, approvals/budgets, missing integrations, recovery, reminders and notification deduplication.
- HTTP integration passed using an isolated temporary database and no Gemini key: real native Finance workflow produced net 65 from supplied 100 income and 35 expense, durable history, recurring controls, local loop commands, authentication/origin checks and live SSE state.
- Browser verification ran a real one-time Analytics → Memory loop through the visible panel; it completed with saved receipts and zero model calls. The local example is labelled Local verification loop and is not recurring.
- Provider generation, search, email acceptance, failure and crash scenarios in unit tests use explicit mocks/fixtures. No paid Gemini, Brave, Fish Audio or Deepgram API test ran, and no real email was sent. Live scheduling while powered off is impossible; restart/missed schedules are tested with fixture clocks.

## Changed files

Added `lib/loops-config.mjs`, `runtime/loop-observers.mjs`, `runtime/loops-engine.mjs`, `components/LoopsPanel.tsx`, `components/loops-panel.css`, `tests/loops.test.mjs`, this guide and preview images. Updated `runtime/engine.mjs`, `runtime/server.mjs`, `lib/runtime-proxy.ts`, `components/runtime-types.ts`, `components/HudPreview.tsx`, `components/HudWorkPanel.tsx`, and `tests/http.integration.mjs`.

The supplied video was visually reviewed. Its visible data-gather stage, research report, agent map and response informed the panel and execution presentation. Scheduling, permission boundaries and crash recovery come from the written request; the video does not independently demonstrate those behaviours.
