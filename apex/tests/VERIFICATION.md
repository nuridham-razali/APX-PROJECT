# Stage 4 verification — 3 October 2026 MYT

## Executed checks

- Original Stage 3 dependency install and Next.js production build: passed.
- Updated production build including strict TypeScript checking: passed.
- `npm test`: 20 runtime/provider/diagnostic/voice tests passed. Provider responses are injected test fixtures;
  they do not claim live Gemini service verification.
- HTTP integration using isolated temporary SQLite state: passed. Checked state endpoint,
  direct-runtime authentication, cross-site write rejection, missing-key response, refusing
  model tasks without a key, memory storage/recall, the 12-item diagnostics endpoint and the SSE state stream.
- Chromium interaction tests: passed with no page errors. Checked workflow save, explicit
  memory command from chat, memory panel deletion, personality slider persistence after reload,
  New conversation, and 390px mobile layout without horizontal page overflow.
- Process supervisor launch/readiness/shutdown on Linux: passed.
- Rendered desktop dashboard, desktop loops and mobile loops inspected visually.

The portable HTTP check is included as `npm run verify:http`; run it after `npm run build`.
It uses temporary data and explicitly disables Gemini credentials for that test process.
The browser QA used a separate test environment; no test fixtures or account state are
seeded into the delivered project. Screenshots in `docs/previews/` are labelled QA captures.

## Checks needing the user's environment

1. Execute Start.bat on Windows with Node 22.13+.
2. Configure an enabled Gemini model and API key. Verify a first question, follow-up and NEW.
3. Start a real text task, immediately ask another question, and verify independent responses.
4. Run a workflow with real project sources and check the output against those sources.
5. Cancel a real task; inspect the distinction between request and confirmed cancellation.
6. Refresh while a task runs. Stop/restart the backend and inspect recovered queued/interrupted state.
7. Enable browser dictation and grant permission. Speak a question, verify transcript,
   silence submission, audible reply and listening resumption. Start a background task, ask
   a second question after the receipt, then test Stop speaking, Cancel, editing a draft,
   denied permission, unsupported browser and a lost connection.

The Windows batch file was not executed in this Linux environment. No live Gemini key was
available. Real microphone audio, browser recognition service and audible speaker playback
were not tested. External actions, schedules and branched loops remain unimplemented.

## Background update checks

Stage 4.1 production build passed. Chromium checked the animated galaxy, motion-off static galaxy and mobile view with no page errors. Existing workflow, memory, settings and chat interaction checks passed after the background change.

## Stage 4.2 HUD, diagnostics and browser voice

- Production build and TypeScript checks passed.
- Seven new diagnostic/voice tests passed, including missing key, successful metadata fixture,
  rejected concurrent checks, silence submission, playback echo exclusion, editing cancellation,
  permission failure, speech errors and Stop speaking while a request is busy.
- Chromium UI tests passed with no page errors: 12-item checklist, 10/12 missing-key result,
  consent gate, fixture dictation of “Apex system check”, response playback state, explicit
  mic resume, off toggle, and 390px mobile layout without horizontal overflow.
- Browser recognition and playback were injected fixtures for deterministic UI checks.
  They do not establish real service availability, microphone accuracy or audible output.
- Rendered desktop and mobile screens inspected; oversized diagnostic lists scroll.
- Two-second startup rings and graph reveal are decorative, independent of check progress.

## Stage 4.3 location HUD

- Production build/TypeScript and 24 tests passed, including four weather tests.
- HTTP rejects missing, nonnumeric and out-of-range coordinates.
- Browser QA checks a ticking clock, device/selected timezone, town selection, saved location
  after reload, temperature/conditions display, stale error handling, refresh recovery,
  explicit geolocation, forgetting, permission denial and 390px mobile overflow.
- Weather and geolocation responses are injected QA fixtures. No sample weather is shipped.
- After configuring the environment's network proxy, live Open-Meteo city lookup and current
  weather passed for Gurun. The actual dashboard route rendered the live values; final desktop
  and mobile captures use real data. Fixture-based error tests are separate.

## Stage 4.4 focus mode

Production build/TypeScript passed. Browser checks verify hidden tabs, weather, agent map,
chat and drawers; visible core/waveform; retained chat draft and open workspace; toggle button,
Ctrl+Shift+F, Escape, persistence after reload, and 390×844 focus view without page overflow.
No new provider, speech or scheduler logic was introduced.

## Stage 4.5 reference essential HUD

- Production build/TypeScript and all 27 unit tests passed, including leap-day validation,
  exact history date selection, source-link validation and failure/empty-history handling.
- HTTP rejects impossible history dates. Live Wikipedia history and Gurun weather displayed
  through the actual production routes; no fixture events or temperatures are in previews.
- Desktop/mobile focus mode retains time, date, weather, On this day and APEX/LOCAL/VOICE.
  Tabs and agent graph stay hidden. Voice read-aloud settings update the visible status.
- Controlled browser clock verifies midnight advances the event date; failed new-day requests
  remove yesterday's event and Retry recovers. Screenshots inspected for placement and overflow.
- Waves draw behind the core with central occlusion; OS/motion-off preferences still apply.
