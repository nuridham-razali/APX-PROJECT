
## Stage 2 — Real chat path
Status: IMPLEMENTED; local build verification pending dependency install.

Changed:
- Added server-side `/api/chat` route using Gemini Interactions API.
- API key is read only from `GEMINI_API_KEY` on the server; it is not sent to browser code.
- Added real conversation state using Gemini interaction IDs stored only as a browser session reference.
- Added chat panel with send, real response display, errors, and New Conversation.
- Replaced the HUD's tap-cycle behavior with a temporary activity test; real chat requests now drive THINKING/IDLE.
- Preserved existing LICENSE and CREDITS files.

Checked:
- Source structure inspected.
- No API key added to source.
- Provider errors are surfaced as errors rather than fake replies.

Not yet complete:
- Voice/microphone.
- Speaking playback state.
- Humanoid states.
- Persistent local memory.
- Windows tools.
- Full production build verification requires dependencies to install successfully.


## Stage 2.1 — Chat endpoint repair (2026-09-19)
Status: PATCHED / awaiting Windows verification

Investigated:
- Researched the current official Gemini Interactions API documentation.
- Confirmed server-side multi-turn state uses `previous_interaction_id`.
- Confirmed `gemini-3.8-flash` is a current stable model.

Changed:
- Corrected the Interactions REST endpoint from `/v1beta/interactions` to `/v1beta2/interactions`.
- Kept `GEMINI_API_KEY` server-side only.
- Kept conversation state via `previous_interaction_id`.

Environment limitation:
- `npm ci` could not complete in the build environment because dependency installation timed out, so a production build cannot honestly be marked as passed here.

Windows verification required:
- Confirm Node.js is 20.9+ for the current Next.js requirements.
- Run `npm ci`.
- Run `npm run build`.
- Set `GEMINI_API_KEY` in `.env.local` only.
- Test first message, follow-up context, NEW conversation, and provider error handling.

## Stage 3 — Personality + Language HUD (2026-09-20)
- Preserved the original APEX-UI orb, reasoning graph, overview lamp, status bar, credits, and license.
- Added a real Personality Equalizer with Default, TARS, and Servant presets.
- Added live 0-100 controls for Sarcasm, Roughness, Directness, Warmth, and Push.
- Added a language selector for English, Malay, and Chinese (UI-level selection).
- Chat requests now send the selected personality values and language to `/api/chat`.
- Gemini receives a server-side `system_instruction` built from those settings; API keys remain server-only.
- No microphone, wake-word detector, or TTS was added in this stage; STANDBY remains a UI state only.
- Build/install was not marked as passing until Windows verification is completed with `npm ci` and `npm run build`.

## Stage 4 — Multitasking foundation / visual workflows (2026-10-03 MYT)

This section supersedes historical endpoint/model and verification assertions above.
The old Stage 2.1 entry claimed v1beta2; the official generateContent REST reference
used in this stage documents v1beta/models/{model}:generateContent instead.
Source: https://ai.google.dev/api/generate-content (checked 2026-10-03 MYT).
No user's live Gemini key was supplied, so this stage does not claim live provider verification.

Baseline:
- Materialized both supplied Stage 2.1 and Stage 3 archives and compared their source trees.
- Chose Stage 3 to retain its personality controls and language selector.
- Stage 3 npm ci and production build passed in this environment.
- Confirmed the archive contains no microphone, speech output, gateway, STT or LiveKit implementation.
- Preserved the original source ZIP, LICENSE and CREDITS.

Implemented:
- Separate long-lived Node runtime; SQLite persistence; local-only authenticated API proxy.
- Foreground conversations and background tasks with separate context and independent execution.
- Durable task receipts, ordered workflow execution, immutable run snapshots and source capture.
- Live state stream, Tasks panel, actual handler capability status and real assigned-agent activity.
- Cancellation request/confirmation, downstream blocking, explicit new-run retries and restart reconciliation.
- Local memory save/retrieve/edit/delete/export; persistent per-device personality/language/motion.
- Editable visual sequential workflow canvas with selected-step inspector and accessible reorder controls.
- Removed unverified Online/integration claims and simulated core tap activity.
- New runtime defaults to 8081 rather than overwriting the existing gateway port 8080.
- Windows Start.bat, process supervisor, setup instructions and full future-stage guide.

Verification:
- npm test: 13 meaningful runtime/provider tests passed.
- Updated npm run build: compilation, TypeScript checking and static generation passed.
- HTTP integration: runtime state, authentication, cross-origin rejection, missing-key errors,
  task rejection without a key, durable memory, recall, and SSE stream passed.
- Browser layout and interaction verification is recorded in tests/VERIFICATION.md.

Remaining checks:
- First message, follow-up, real background task and real workflow using Idham's configured Gemini key.
- Windows execution of Start.bat and process shutdown (scripts authored here; runtime verified on Linux).
- Later working voice/gateway source merge, echo guard and the hands-free acceptance scenario.
- Social connections, publishing approvals, schedules, goals and freeform/branched workflow authoring.

Final checks: queued tasks retain their configured model; unavailable task-agent assignments are rejected. Process supervisor start/stop passed on Linux.

## Stage 4.1 — Galaxy background (2026-10-03 MYT)
- Replaced the flat navy background layer with a local procedural star field, diagonal galaxy, dust lanes and cyan/gold nebula glow.
- Added slow cyan and gold wave ribbons and gentle star shimmer.
- Motion-off/OS reduced-motion keeps the galaxy and waves visible as static artwork.
- Cached the sky artwork; capped canvas resolution and animated draws to approximately 30fps. No remote imagery or new dependency.
- Existing orb, workspaces, chat, provider, task runtime and memory remain as in Stage 4.
- Verification: production build and desktop/mobile Chromium render checks passed; motion-off retains the sky and ribbons; no page errors. Existing workflow, memory and settings checks also passed.

## Stage 4.2 — Reference HUD and system check (2026-10-03 MYT)

Reviewed the supplied 24.7s system-check clip. Added compact header and Kuala Lumpur clock,
startup ring animation and agent reveal, a real 12-item runtime checklist, and a chat/voice
system-check command. Preserved galaxy stars, cyan/gold waves and multitasking workspaces.
Added optional browser dictation with processing notice, explicit opt-in, silence submission,
draft editing/cancel, half-duplex microphone pause during foreground turns and speech,
read-aloud toggle, stop playback and explicit resume after errors.

20 tests, production build, HTTP checks and fixture-driven browser UI checks passed.
No live Gemini credentials or real microphone/audio devices were used. Windows Start.bat
and live browser speech need the user's environment. This implements the observed interaction;
it does not claim the reference project's private internals or unavailable integrations.

## Stage 4.3 — Clock, local weather and temperature (2026-10-03 MYT)

Clarified the requested design: visible clock/date plus the chosen location's weather and
Celsius temperature. Added a cyan/gold two-part HUD card, location search, explicit browser
geolocation, per-device saved selection, forget action, timezone-aware clock/date, conditions,
feels-like and humidity. Weather refreshes every ten minutes with manual retry and stale labels.
Replaced the old Vercel-only geo-header route, which returned no weather on localhost, with
validated coordinates and a town-search route backed by Open-Meteo. No location or temperature
is invented. Preserved the existing assistant, galaxy, voice and workspaces.

24 unit tests and the production build passed. HTTP checks reject missing/invalid locations.
Browser checks use explicit weather/geolocation fixtures for selection, display, persistence,
refresh failure/recovery, forgetting, permission denial and mobile layout. Initial direct requests timed out; using the environment's network proxy resolved access.
Live Gurun location lookup and current weather were then verified through the actual API and
rendered in the dashboard. Final previews show those live readings, not the test fixtures.

## Stage 4.4 — Clean core focus mode (2026-10-03 MYT)

Added a per-device focus view hiding every panel, tab and agent map. Kept the galaxy core
and a minimal cyan/gold waveform; waveform activity follows real assistant states.
Show dashboard, Ctrl+Shift+F and Escape restore access. Components remain mounted to keep
voice, drafts, workspaces and background processing intact. Included a source backup of 4.3.
Production build/TypeScript and browser focus-mode checks passed; microphone amplitude
analysis is not claimed by the decorative waveform.

## Stage 4.5 — Reference essential HUD (2026-10-03 MYT)

Reviewed the newly supplied 25.2-second reference. Moved flowing cyan/gold waves behind the
core and retained a compact clock/date, local weather/temperature, historical event and
APEX/LOCAL/VOICE status block in Focus mode. Status derives from actual runtime and voice UI
state. Added a date-validated Wikipedia history endpoint and source-linked daily event,
following the clock timezone and reloading at midnight with retry/error handling.

Validation: production build, 27 unit tests, live-history/weather browser checks, mobile layout,
voice-status updates, and controlled midnight/error/retry tests passed. Wave paths are masked
within the core so they appear behind it. User API keys and microphone recordings were not used.

## Stage 4.6 — Concurrent backend tasks (2026-10-05 MYT)

Preserved the approved frontend and added a 4.5 source backup. Replaced the single background
worker with bounded slots (default 2, configurable 1–3). Foreground chat remains independent;
workflow steps stay ordered and task context stays isolated. Added /status, /result, /cancel
and /retry chat commands with unambiguous task ID resolution. Extended real runtime snapshots
and existing agent/activity indicators for multiple running jobs. Graceful shutdown now marks
interrupted jobs Needs review with partial output retained rather than silently cancelling them.
Queued work remains queued; explicit cancellation remains distinct from interruption.

Validation: 34 unit tests passed, including concurrency, slot refill, context isolation,
individual cancellation, shutdown recovery, command receipts and ID ambiguity. Production
build/TypeScript and local HTTP integration checks passed. No live Gemini request was made;
provider behavior was tested with fixtures. Windows launch/actual voice still require local checks.
Backend structure and sequenced future milestones are in docs/BACKEND-PLAN.md.
