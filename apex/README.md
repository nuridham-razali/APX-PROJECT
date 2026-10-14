# APEX Stage 4 — multitasking foundation and visual workspace

Stage 4.6 adds bounded parallel background jobs, chat task controls and graceful interruption recovery. The approved frontend is retained. See `docs/BACKEND-PLAN.md` for the current structure and next milestones.

Stage 4.5 keeps clock, date, location, weather/temperature, On this day and APEX/LOCAL/VOICE status visible in the clean Focus view, with the cyan/gold wave behind the core. Stage 4.2 added the compact system HUD, orb startup rings, real 12-item diagnostics, and optional browser dictation and spoken replies. The space galaxy, stars and cyan/gold waves remain; Motion off keeps a static galaxy.

Built for Idham Razali from the supplied Stage 3 Personality HUD archive.
This is a runnable local Windows project with the original orb and agent graph,
a separate background runtime, persistent task history and memory, and an editable
sequential workflow workspace. The full video feature set is staged in
`docs/APEX-Assistant-Build-Guide.md`.

## What works in this stage

- Foreground Gemini conversation and background Gemini text tasks use separate context.
- `/task` acknowledges the saved job promptly; its worker continues after the chat turn ends.
- Up to two background jobs run at once by default; conversation requests run independently.
- Set `APEX_BACKGROUND_CONCURRENCY` to 1, 2 or 3 and restart to change the limit. Each workflow still runs its own dependent steps in order.
- `/status ID`, `/result ID`, `/cancel ID` and `/retry ID` operate on saved task records without an extra model call.
- The Loops workspace saves workflows with manual Trigger, Gather, configurable Work steps,
  and Notify. Add, assign, reorder, and remove Work steps with keyboard-accessible controls.
- Each run keeps its own source/definition snapshot. Edits affect future runs.
- SQLite saves conversations, workflow definitions, tasks, step outputs, and explicit memory.
- Real task and step states reach the HUD over a same-origin event stream.
- Cancellation, failed-step blocking, explicit retry, and interrupted-run recovery are implemented.
- Task results remain available after browser refresh. Viewing them marks the completion as read.
- Memory supports save, substring search, correction, deletion, and JSON export.
- Personality and language settings persist on this device. Motion respects the OS preference.
- Missing runtime or Gemini configuration produces an error, never a simulated response.

## Start on Windows

1. Extract this ZIP into a **new folder**. Keep your current working APEX folder intact.
2. Install Node.js **22.13 or newer** if it is not already installed.
3. Double-click **Start.bat**. On first launch it creates `.env.local` and opens Notepad.
4. Enter your existing Gemini key after `GEMINI_API_KEY=`. Save and close Notepad.
   Do not include quotation marks, and ensure the filename is `.env.local`, not `.env.local.txt`.
5. Press a key in the launcher window. It installs locked dependencies, runs the runtime tests,
   builds the dashboard, and starts both processes.
6. Open **http://127.0.0.1:3000** if the browser does not open automatically.
7. Keep the launcher window open. Use **Ctrl+C** to stop APEX.

No subscriptions or integrations are provisioned by this package. Starting a Gemini task
uses your configured account and its existing quota/billing. No live Gemini call was made
while building this package because no user API key was supplied.

The runtime defaults to **127.0.0.1:8081**, leaving the previously used WS gateway
on port 8080 separate. This package does not include or replace that WS gateway.
If 8081 is occupied, set another `APEX_RUNTIME_PORT` in `.env.local` and restart both processes.
The dashboard uses port 3000. Close your previous UI before starting this isolated build.

## Clean core view

Click **Focus mode** to hide tabs, chat, agent map, diagnostics and drawers.
The core and cyan/gold wave remain, with a compact upper-left block containing the clock, date,
location, weather/temperature, On this day, and APEX/LOCAL/VOICE status. The flowing wave crosses
behind the core, matching the supplied reference layout. A small **Show dashboard**
button restores the dashboard. **Ctrl+Shift+F** toggles the mode; **Escape** returns to the full
view. The choice is remembered on this device. Hidden components stay mounted: voice, chat
requests and background jobs keep running; drafts and open workspaces survive the toggle.
Restore the dashboard to access microphone, playback and other controls.
The waveform reacts to actual listening, processing and speaking states; it is decorative,
not a microphone amplitude analyser. Motion off/OS reduced motion also stops bar animation.

## On this day and essential status

The historical event follows the same calendar date and timezone as the clock, including
midnight and location changes. It comes from Wikipedia's date-specific On this day feed,
with a source link. A failed request displays Event unavailable and Retry. Events are never
substituted with invented content. This feed needs internet access to en.wikipedia.org.
APEX reports idle/listening/thinking/speaking; LOCAL reports the background runtime connection;
VOICE shows microphone and read-reply settings, or active listening/playback. LOCAL Connected
does not assert that a Gemini model call succeeded. Use Show dashboard for microphone controls.

## Clock, weather and location

The dashboard shows a live 24-hour clock and full date. Until you choose a location, the
clock uses your device timezone and weather shows **—°C**, with no guessed temperature.
Click **Change** in the weather panel. Search your town (for example, **Gurun**) and choose
the correct result, or click **Use my current location** and grant browser permission.
No location request runs automatically. Browser coordinates are rounded to 0.001 degrees
before use; the selected coordinates are sent to Open-Meteo for weather and saved on this
device. **Forget location** removes the saved selection.

Weather includes Celsius temperature, conditions, feels-like temperature and humidity.
The selected location's timezone controls the clock and date. Data refreshes every ten
minutes; the refresh icon also retries immediately. The update time is the provider's
current-weather timestamp in that timezone. On failure, the previous reading is marked
**STALE**; if there is no previous reading, no temperature is shown. Open-Meteo provides
model-based weather for the location, not a sensor reading from your house.

This personal local project uses Open-Meteo's public API without a weather key. Internet
access to api.open-meteo.com and geocoding-api.open-meteo.com is required. Live town lookup and weather readings were verified for Gurun in the build environment.
Error/permission tests also use explicitly injected fixtures. Choose your town after startup;
the ZIP does not contain a preset location or sample weather.

## Startup and voice

Click **INITIALIZE APEX** to run the checks and show the checklist. The expanding rings and
agent reveal are decorative startup animation; the checklist reads actual runtime results.
Type **system check** or **Apex system check** to run the same action from chat.
Twelve passes verify local checks and model metadata access, not a successful generation or
external tools. With no API key, the expected result is 10 passed, one failed and one skipped.

**Enable microphone** first shows a browser-processing notice and an agreement checkbox.
Dictation depends on browser support and permission; try Chrome or Edge on your local PC.
It is off on every page load. Speech accumulated in the input sends after 2.5 seconds of
silence. Edit the input to pause auto-send, use **Cancel** to discard it, and use **Resume
microphone** to listen again. Language follows English, Malay or Chinese settings.

**Read replies aloud** uses the browser's available voices. Listening stops during each
foreground request and reply playback, then waits 750ms before resuming. A background task
does not keep the mic paused after its receipt. **Stop speaking** ends playback. This is
half-duplex: speak again after playback, or stop playback first. Automatic recognition
restart can be blocked; the controls show errors and a Resume action. Model calls and
speech events drive PROCESSING / SPEAKING / LISTENING; these are not simulated states.
No live microphone or audible speaker test was possible in the build environment. Browser
controller behaviour was verified with explicitly injected recognition/playback fixtures.

## Try the multitasking behaviour

In chat, enter:

```text
/task Draft a concise project update from these notes: [paste real notes here]
```

APEX returns a task receipt. While it runs, send another ordinary question or type `/tasks`.
Open Tasks to see real state, Cancel, and View saved result. The model call can finish quickly;
use sufficiently substantial real source material to observe overlap. No artificial delay is
inserted into normal execution.

Other commands:

```text
/remember I prefer blue cars
/recall blue
/tasks
open loops
open tasks
open memory
```

**NEW** starts a new conversation while retaining memory and background tasks.
Chat retains the latest 30 provider turns in server-owned context and the latest 60
message bubbles on this device. This is bounded context, not unlimited recall.
Explicit memory is separate and remains until removed.

## Run your first workflow

1. Open **Loops**.
2. Use the Weekly APEX Project Review starting instructions or enter a new name.
3. Paste real, titled project notes/build logs in **Source material**.
4. Select a Work node to edit its agent and instructions. Add, remove, or reorder steps.
5. Click **Save & run**. Open **Tasks** and continue chatting while it runs.
6. Inspect the saved result and any source gaps.

Gather uses exactly the pasted material. Researcher analyses it; it does **not** browse.
Notify saves the result in APEX; it does **not** send an email or Slack message.
Provider/model configuration is not proof of an authenticated successful Gemini call.
Run one first message and follow-up with your own key before calling the connection verified.

## Persistence, recovery and backup

Local state is stored under `.apex-data/` (or your configured `APEX_DATA_DIR`).
Never upload this folder to GitHub: it contains your conversations, facts, results and a local
runtime access token. The project ignores this folder and `.env.local` in Git.

Stop APEX before copying the entire data directory for a backup. Keep that backup private.
The original Stage 3 source ZIP is included under `backups/` for rollback.

A browser refresh does not stop the backend worker. If the runtime exits unexpectedly,
queued work remains queued and interrupted running work becomes **Needs review**.
Review saved output and click **Retry as new run** if you want to regenerate. The original
run is preserved. Provider requests may already have consumed quota even if no result was saved;
the app does not silently retry an interrupted request.

Keep APEX local: this version binds to loopback, uses a private runtime token, and checks the
browser origin. It is not packaged for public Vercel deployment or multi-user authentication.

## Current boundaries / next stages

- The inspected Stage 3 archive has **no STT, microphone, TTS, wake word, humanoid, Fish Audio,
  or LiveKit code**. This update adds a separate browser speech implementation. It does not
  merge an unseen gateway, LiveKit, Fish Audio or Whisper implementation. “Apex” at the start
  of a transcript is stripped as a convenience; there is no always-on wake-word detector.
- Loops are saved sequential workflows. Freeform drag wiring, parallel branches, approval nodes,
  schedules and missed-run handling are planned next.
- Social workspace, comment grouping/replies, platform posting, goal measurements/charts,
  Gmail/Calendar/Drive/CRM integrations, image generation, and Windows monitor control remain planned.
- Only text handlers for Chief of Staff, Researcher (supplied sources), Strategist, Editor and
  Social (draft text only), plus local memory, are available. Other nodes say Not configured.
- No external send/publish action exists in this stage. The approval requirements remain in the guide.
- Gemini is configured server-side using the documented `v1beta/models/{model}:generateContent`
  request shape. The model default preserves your preferred `gemini-2.5-flash-lite` ID; availability
  and quota must be checked using your own account. Configure a supported model in `.env.local`.

## Developer commands

```bash
npm ci
npm test
npm run build
npm run verify:http
npm run launch
```

For UI development, run `npm run runtime` and `npm run dev` in two terminals.
Both must run from this project directory with the same `.env.local` and data-directory setting.
The runtime uses Node's built-in `node:sqlite`; some supported Node versions display an
experimental SQLite warning. No extra database service is required.

See `BUILD_LOG.md` for verified checks and explicit remaining checks. Unit tests use labelled,
injected provider fixtures, never fake production data. See `tests/VERIFICATION.md` for HTTP/UI checks.

## Credits and license

The original APEX-UI orb, graph and community component notices are preserved in
`LICENSE` and `CREDITS.md`. Original interface: https://github.com/RubenM1990/APEX-UI.
The original upstream name/branding has separate restrictions noted in its source README,
which remains available inside the original Stage 3 backup. This personal project uses your
existing APEX name; the code license does not grant upstream brand rights.

## Stage 4.6 task controls

Use the first eight characters of the task ID from the receipt, or its full ID:

```text
/task Summarise these notes: [paste your notes]
/tasks
/status YOUR_TASK_ID
/result YOUR_TASK_ID
/cancel YOUR_TASK_ID
/retry YOUR_TASK_ID
```

Replace YOUR_TASK_ID with the actual ID. Ambiguous prefixes are rejected. Retry creates a new
run for a failed or interrupted task; the original run is preserved. Partial output is labelled
with its actual task state. Commands work through the existing chat input; no new panel is required.
Use `/task` or the Tasks workspace explicitly: natural-language task routing is a later stage.

Two jobs may call Gemini at once, plus an independent chat request. Account quota still applies;
this does not guarantee provider latency. Set concurrency to 1 if you prefer serial background work.
No provider errors automatically retry or duplicate a paid call. Stopping APEX puts interrupted work
into Needs review, keeps saved partial output, and leaves unstarted jobs queued. An explicit cancel
remains cancelled. On Windows, forced process termination is recovered on the next startup.
