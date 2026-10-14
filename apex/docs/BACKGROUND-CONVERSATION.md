# Conversation during real background work

The existing SQLite engine and role handlers now feed task acceptance, status, completion text, conversation history and voice. The HUD and provider settings are preserved. No external service was added.

## Behaviour

- Task records are saved before acknowledgement, with conversation ownership, scope, steps, permissions, timestamps, results and errors. Node events retain actual tool receipts and handoffs.
- A short request to the configured model supplies a personality-aware acceptance opener. It cannot supply execution status: progress/timing claims are rejected and a fresh task receipt supplies the facts. A five-second deadline falls back to the truthful receipt. Ordinary conversation continues to use the existing personality instructions and memory.
- Status queries use local records, without model inference. Ambiguous references ask which task, rather than choosing silently. No invented percentages or finish times.
- The existing bounded inference scheduler reserves foreground admission and limits background inference. This does not guarantee simultaneous token generation inside Ollama; a single-server model can still serialize calls. Active inference is not forcibly preempted.
- Background work does not keep the central orb THINKING. Actual task nodes show work; the central orb and voice indicator show foreground interaction.
- Browser recognition pauses for the short foreground turn and its audio, then resumes even while background work continues. Deepgram remains conversational between turns; its microphone tracks and frame forwarding are disabled during reply playback, then restored only for the current enabled session.
- Completion, failure, blockers and cancellation create persistent notices. Idle UI claims each notice once, stores the exact text in history, shows it on the HUD and sends the same text through the existing ordered Fish Audio queue. Pending speech/drafts and foreground responses defer announcements. No repetitive progress announcements.
- Speech interruption never cancels a saved background task. Tasks require explicit cancellation.
- Conversation IDs survive reloads and saved history is restored. New conversation starts a separate context. Interrupted work is Blocked after restart, never falsely reported as still running.
- Unconfigured email/calendar/Drive requests are blocked before acknowledgement. Connected services still check actual access during use. External writes retain existing exact-action approval requirements.

## Commands

Examples: `Draft a memo about…`, `Research…`, `What is still running?`, `Is it ready?`, `Cancel that task`, `Cancel task <ID>`, `Update task <ID> to <revised instructions>`.

Queued amendments change actual role instructions. Running tasks require explicit cancellation before replacement. Other ambiguous amendments stay conversational; they do not silently rewrite work. Existing `/task`, `/loop`, `/status`, `/result`, `/cancel` and `/retry` commands remain supported. English natural routing is conservative; unsupported phrasing may require an explicit task command.

## Validation

- 199 automated tests passed, including real SQLite/engine execution with mocked model outputs, conversation isolation, handoffs, failure, restart, cancellation, canonical notices, browser recognition lifecycle and Flux capture gating.
- Production build/type checking passed. HTTP integration passed with missing credentials, authentication/origin protection, conversation restore and notice routes; no paid providers were called.
- **Real local integration:** installed `qwen2.5:3b` accepted a task; a foreground question was submitted while its handler was running and answered “Two plus two is four.” The task returned “APEX is a personal assistant.” Completion text was saved unchanged. This used isolated in-memory test storage and no voice APIs.
- **Mocked browser integration:** fake recognition, mocked model output, actual playback of a synthetic five-second WAV. Wake-only made zero chat requests. A second spoken question arrived while the task was running. Completion was delivered once, matched TTS/history exactly, and listening resumed (four recognition starts across the interaction). This does not validate a physical microphone or Fish Audio synthesis.

The screenshot `previews/apex-background-conversation.png` is explicitly a mocked verification view, not a production task result.

## Changed files

- `runtime/engine.mjs`: task ownership, grounded acceptance, scoped status/cancel/amend, persistent completion notices and history claims.
- `runtime/conversation-routing.mjs`: natural status/task control commands, ambiguity and public state labels.
- `runtime/provider.mjs`: bounded short acceptance output; model/provider unchanged.
- `runtime/server.mjs`, `lib/runtime-proxy.ts`: authenticated conversation/notice routes.
- `components/HudWorkPanel.tsx`, `components/runtime-types.ts`: restored context, completion HUD/history/audio delivery and public task labels.
- `lib/browser-voice-session.mjs`: safe announcement pause/resume.
- `lib/flux-capture.mjs`, `components/useApexVoice.ts`: capture gating around playback.
- `lib/assistant-activity.mjs`: foreground-only orb state.
- Tests: `background-conversation.test.mjs`, `background-local.integration.mjs`, `browser-voice-session.test.mjs`, `apex-voice.test.mjs`, `assistant-activity.test.mjs`, `runtime.test.mjs`, `http.integration.mjs`, `humanoid-ui-fixture.mjs`.

## Running

From `C:\Users\Win11\Documents\ChatGPT\New project\apex`, keep Ollama running with your existing model installed. Use `Start.bat` or `npm.cmd run launch`; alternatively run `npm.cmd run runtime` and `npm.cmd start` in separate terminals after `npm.cmd run build`. Open http://127.0.0.1:3000/ and enable the microphone explicitly.

Run `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run verify:http` for offline checks. `node tests/background-local.integration.mjs` explicitly calls local Ollama and refuses another provider. Paid microphone/voice integration tests still need approval.

Unavailable integrations remain unavailable until configured; this work does not add deployment, publishing, purchases or Windows-setting tools. Acceptance language is intentionally constrained so model personality cannot fabricate execution facts.
