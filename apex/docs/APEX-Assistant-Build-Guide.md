# Build your APEX assistant: conversation, background work, and a live HUD

Prepared for Idham Razali · 3 October 2026 · Guide without implementation code

## Required addition to the APEX project build

The multitasking architecture in this guide and the visual loops workspace from the supplied `1000130176.mp4` are required parts of the APEX project build. Implement them within the existing assistant, sharing its conversation, task manager, memory, registered agents, and approvals. The requirements below are planned work, not a claim that the project code has been updated.

## What you are building

An assistant that acknowledges a request, performs the work separately, keeps talking with you, and delivers the verified result afterward. The supplied screenshot defines the dashboard direction: deep navy background, cyan particles and circuit lines, a gold central ring, specialist nodes, a compact overview, and voice status at the bottom.

Example target interaction:

1. You: “Create a futuristic sports car image.”
2. Assistant: “On it.” The task is accepted and shown in the task panel.
3. You: “What are you working on?”
4. Assistant: “Your car image is still being generated.” The image task continues.
5. You: “Remember that I prefer blue cars.”
6. Assistant saves that preference and confirms the save.
7. The image completes. The result appears immediately; the spoken announcement waits until you finish your current turn.

The following architecture is a proposed implementation for your project. It is not a claim about Reznikov Engineering’s private production system.

## Reference material and its limits

The public products page separates the interface, Open Loop, Humanoid, Closed Loop, and build review. It describes the free interface as the HUD foundation, the Open Loop as chat/voice/tools foundations, and the Closed Loop as persistent memory, scheduled work, and verified actions. Those are useful stages for your build. This guide uses the public outline; it does not reproduce the paid course or claim to have read its chapters.

The public APEX-UI repository provides the orb and agent graph. Its README says the production voice layer and humanoid are separate. Keep the code’s license and credits. The repository also distinguishes the code license from its product name and branding; select your own public branding if you distribute the assistant.

References:

- Product overview: https://reznikov-engineering.com/products
- Interface source: https://github.com/RubenM1990/APEX-UI
- Free Open Loop entry: https://guide.reznikov-engineering.com/open-loop
- Gemini Interactions: https://ai.google.dev/gemini-api/docs/interactions-overview
- Gemini background execution: https://ai.google.dev/gemini-api/docs/background-execution
- Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling

The Open Loop entry was accessible, but its chapter text was not returned by the web reader. Provider details were checked against Google’s official documentation. Recheck model availability and pricing when implementing; this guide starts no paid services.

## Your uploaded Stage 2.1 starting point

These observations come from inspecting APEX-ASSISTANT-STAGE2.1.zip, not from assuming it matches your later working builds.

| Area | What the archive contains | What the next implementation must add |
|---|---|---|
| Dashboard | Next.js UI, gold orb, particle core, agent graph | Task and conversation activity displayed independently |
| Chat | Server-side Gemini route and message panel | Short acknowledgements, task routing, and independent background execution |
| Input | Disabled while a request is pending | Release it after a background task is accepted |
| Conversation context | An interaction reference in browser local storage | Server-owned conversation state and separate context per task |
| Voice | Not implemented in the inspected chat panel | Microphone, transcription, speech playback, and echo protection |
| Agent map | Fixed role descriptions and status labels | Real tool registration, readiness checks, and job events |
| Memory | Not implemented | Persistent facts, source tracking, retrieval, deletion |
| Reliability | Build log records verification still pending | Verify the actual package before adding functionality |

Important chat repair: the archive uses /v1beta2/interactions. The official documentation reviewed for this guide shows /v1beta/interactions. Resolve that discrepancy before building on this route. Select a model supported by your account and the endpoint; a model name in an old build log does not prove that requests succeed.

The archive also has a short orb activity test triggered by tapping the core. Keep demo behaviour explicitly labelled, or replace it with a real microphone action. A visual effect must not imply that a real task was started.

## Choose a simple first architecture

Use the supplied Next.js frontend. Add a long-lived backend with a task manager, worker, persistent database, and event connection to the browser. A local Windows deployment is a sensible first target for your personal assistant. The backend must remain running for local jobs to continue; refreshing the browser should not stop them.

| Component | Responsibility |
|---|---|
| Conversation handler | Respond quickly, route requests, answer follow-ups |
| Task manager | Save jobs, choose workers, track state, handle cancellation |
| Worker | Execute tools and longer model requests |
| Event connection | Deliver real task and conversation updates to the HUD |
| Database | Store tasks, messages, memory, approvals, and result references |
| Voice controller | Manage listening, turn completion, and spoken replies |

Start with one background worker and reserve capacity for conversation requests. Later increase background concurrency after measuring responsiveness and provider limits. A single model service can handle separate requests where supported; distinct agent labels do not require distinct model subscriptions.

Suggested initial storage is a local database on persistent disk. If moving to cloud hosting, use persistent storage and a worker platform that explicitly supports jobs. Do not assume an unfinished task will survive after a normal web request returns. Provider background execution can handle supported model work; local tools and external actions still need application orchestration.

## Phase 1 — Establish a verified chat foundation

1. Make a backup of the supplied ZIP and work from a separate extracted copy.
2. Confirm the interface opens and the project builds with its installed dependencies.
3. Validate the Gemini endpoint, configured model, first response, and follow-up context.
4. Keep API keys on the backend. Return useful errors without exposing credentials.
5. Record request start, first visible response, and completion times.
6. Confirm a new conversation resets chat context without deleting persistent memory or cancelling unrelated tasks.

Pass condition: a first message and follow-up succeed; invalid configuration produces a clear error. Do not treat the archive’s previous verification notes as a new test result.

## Phase 2 — Implement multitasking with text first

1. Separate a short conversation turn from a background job.
2. When a long task is accepted, save its instructions and return its task ID promptly.
3. Show an acknowledgement and release the conversation input.
4. Run the job separately. Keep one foreground conversation response in order while background jobs run independently.
5. Give every task its own context and result record. Do not let a worker overwrite the foreground conversation’s interaction reference.
6. Let the foreground assistant retrieve a concise status snapshot when asked about work.
7. Save results and publish a completion event when actual execution succeeds.

Task record: ID, owner, original request, assigned role, state, timestamps, last verified progress, cancellation flag, provider reference when present, result location, and error summary.

Task states: queued, running, awaiting input, awaiting approval, completed, failed, cancellation requested, cancelled. Distinguish a cancellation request from confirmed cancellation.

Google’s background execution documentation describes an immediate interaction ID followed by status polling or streaming. This can support suitable Gemini work. It does not automatically preserve your app’s task history, provide tools you have not connected, or keep conversation context consistent; the task manager still owns those responsibilities.

First proof: use a clearly labelled test job with a controllable delay. Ask another question while it runs. Once that passes, connect one real long-running tool. Never present the test delay as genuine research or generation.

## Phase 3 — Add natural voice turns

1. Keep the microphone off initially. Explain the selected transcription service and obtain permission when enabling it.
2. Display recognised words as the user speaks.
3. Restart the silence timer whenever speech resumes. Send after 2.5 seconds of silence.
4. Do not send empty transcripts. Editing cancels automatic submission; provide Cancel.
5. Pause recognition while submitting the short foreground turn and while playing the reply.
6. After the brief acknowledgement finishes, resume listening while the background job continues. Do not hold the microphone off for the lifetime of the background job.
7. Keep one speech output playing at a time. Start “speaking” only when audio actually plays; use playback completion to resume listening.
8. Discard assistant audio and its trailing echo from recognition. If automatic resumption fails, show Resume microphone.

Use a modular speech-to-text → conversation → text-to-speech pipeline first. Keep any working voice pipeline from a later project version when adapting this guide. For a closer hands-free interruption experience, add an explicit second stage with acoustic echo cancellation and tested interruption detection. At that stage, user speech can stop reply audio while leaving background jobs intact.

Commands must have distinct effects:

| User says | Behaviour |
|---|---|
| “Stop speaking” | Stop reply playback |
| “Cancel the image task” | Request cancellation of that job |
| “What is running?” | Read actual task state |
| “Make it blue” | Identify the relevant job and apply a supported edit, or explain regeneration |
| “Remember that” | Save the stated fact and confirm successful persistence |

If two tasks could match “that”, ask which one. Never silently change the wrong task.

Pass condition: start a long job by voice, hear the acknowledgement, speak another question during that job, receive a reply, and hear the result afterward without recording the assistant’s own voice.

## Phase 4 — Match the dashboard reference with live states

Keep the screenshot’s navy/cyan/gold design. Reuse the existing components for the main structure.

| Existing component | Planned change |
|---|---|
| ChatPanel.tsx | Separate foreground pending state from background jobs; retain an accessible message composer |
| ApexWorld.tsx | Receive actual activity events and keep agent readiness separate from activity |
| ReasoningWeb.jsx | Highlight only the specialist assigned to an actual job |
| ApexHeroOrb.tsx and orb components | Respond to listening, short conversational thinking, and real playback |
| OrbStatusBar.jsx | Show actual microphone/playback state rather than implying a connection |
| ApexOverviewPanel.tsx | Show local time, actual configured user/location, and verified overview data |
| app/api/chat/route.ts | Keep provider calls behind the server and route long tasks through the task manager |

The main orb represents conversation: idle, listening, thinking, speaking, or error. Agent nodes represent background work. This allows the orb to show listening while Researcher is processing a job.

Add a compact Tasks panel available from the top controls. Each row shows the request, worker, real state, last verified step, elapsed time, and View result or Cancel. Avoid invented percentages. “Generating image” is valid when detailed progress is unavailable.

Clicking an agent opens a panel with configured tools, connection state, current jobs, last result, and limitations. A specialist that only has a role description should say Not configured. A connected but unused specialist is Ready; a running job is Working. Use text as well as colour.

Drive, Email, Calendar, and CRM nodes remain unavailable until the necessary connections succeed. Keep API health separate from an agent’s role colour. Never carry the reference’s location, name, historical event, or “All systems nominal” into your live UI as real user data.

On smaller screens, move to a compact orb with agent list and task drawer. Keep the composer reachable and long conversations scrollable. Retain the motion setting and respect system reduced-motion preferences.

Pass condition: the screen can simultaneously show Conversation listening and Researcher working, and a failed service visibly changes status without fabricated replies.

## Phase 5 — Add persistent memory

Begin with explicit memory commands and retrieval. Store each fact with its source, date, category, and any later correction. Keep conversation transcripts separate from durable user facts.

Before answering a project-history question, retrieve the matching records. If the project start date has not been saved, say so. For a birthday question, use the recorded birthday and current date to calculate age. Do not infer a birthday from unrelated history.

Provide a Memory panel with search, inspect, edit, export, and delete. Confirm “remembered” only after storage succeeds. Restart the app and verify the fact remains searchable. Provider conversation history has retention limits and is not a replacement for your own durable memory.

Pass condition: save a preference, restart, retrieve it, correct it, and delete it successfully.

## Phase 6 — Make the agent map functional

Implement the first useful roles, then expand. Each role needs instructions, a tool allowlist, a job handler, and result evidence. It need not run continuously to be useful.

| Role | Initial capability | Evidence of success |
|---|---|---|
| Chief of Staff | Route requests and summarise open work | Correct role and live task list |
| Memory | Save and retrieve facts and decisions | Matching stored records |
| Researcher | Research connected sources and compare findings | Sources attached to findings |
| Editor | Revise a supplied draft | Saved revised draft |
| Design | Generate an image through a connected image service | Actual returned image |
| Strategist | Review supplied goals and completed work | Recommendations tied to records |
| Social | Draft posts and propose a queue | Reviewable drafts; approval before publishing |
| Sales / CRM | Work with connected leads and pipeline | Correct records and verified updates |
| Operations | Review real inventory and flag shortages | Source records and explicit calculations |
| Analytics | Summarise connected operational data | Traceable metrics |

Show Finance, Engineering, Developer, Marketing, and other roles as planned until their actual tools and task handlers are implemented. A job without required data should wait for input or report the missing source.

## Phase 7 — Add approvals, schedules, and recovery

For external actions, prepare a concrete preview: recipient or destination, content, scope, and proposed action. Your social agent must obtain approval before publishing or scheduling. Require confirmation for disruptive Windows actions such as shutdown, restart, or disabling Wi-Fi. Approval belongs to the specific proposed action, not every step of an internal task.

After an action, verify the external result and record the receipt or returned identifier. Avoid duplicate sends by assigning one operation identity to each approved action. Retry safe reads; do not blindly retry a send or purchase after an uncertain response.

Add schedules only after a real task works on demand. Save timezone, schedule, task instructions, next run, last run, and delivery destination. Your Kuala Lumpur timezone should govern personal schedules. If the local machine is off or asleep, show that local schedules cannot run and define what happens to missed runs.

On restart, recover queued tasks and reconcile running jobs against provider state. A lost connection means status unknown until checked; it does not mean the work failed. Persist result notifications so reconnection does not lose them or announce them twice.

Pass condition: refresh and reconnect during a task, recover the correct state, and verify one approved action executes once.

## Build order and completion gates

| Stage | Deliverable | Gate before moving on |
|---|---|---|
| Foundation | Verified chat and original HUD | Build and follow-up conversation succeed |
| Multitasking | Task store and independent worker | Chat works during a real background task |
| Voice | Transcription, playback, echo guard | Second spoken request works during that task |
| Live dashboard | Independent orb, node, and task states | Screen reflects actual pipeline events |
| Memory | Searchable durable facts | Save/restart/retrieve/delete succeeds |
| Specialists | Roles connected to actual tools | Each enabled role returns evidence |
| Closed workflow | Approvals, schedules, recovery | Verified actions and restart recovery succeed |

Back up each accepted stage and append its changes, checks, failures, and unresolved issues to the build log. Measure acknowledgement delay, transcript-to-answer delay, playback start delay, background completion time, and dropped/duplicated events. Set targets based on measurements of your hardware and services rather than promising video-like speed before testing.

## Final acceptance scenario

Start image generation. Ask a project question while the image is running. Save a preference. Check image status. Stop one spoken response without cancelling the image. Refresh the browser and recover the job. Receive the image once. Trigger a provider failure and see an honest error. Attempt social publishing and receive a reviewable approval request. Restart the backend and confirm saved memory is still available.

When this scenario works, you have the responsive multitasking behaviour demonstrated in the videos, with a dashboard grounded in real execution.


## Visual loops workspace — additional video requirement

The supplied clip shows a workspace titled “Weekly business review”, connected Trigger → Gather → Work nodes, agent cards, stage cards including Notify, configuration chips for model/memory/tools, and a status legend. It shows an instruction to drag agents onto steps. This is a visual reference; the short recording does not establish the underlying execution, persistence, or notification implementation.

### Integrate the workspace into APEX

Add a Loops workspace accessible from the main dashboard, keeping chat and voice reachable while a loop runs. Reuse the existing navy, cyan, and gold design. The workflow canvas supplements the agent map: the map shows specialist capabilities, while the canvas shows the ordered work for a particular workflow.

Support these first building blocks:

| Block | Required behaviour |
|---|---|
| Trigger | Start manually first; add scheduled triggers after reliable execution and recovery are verified |
| Gather | Read selected connected sources and retrieve relevant memory; retain source references |
| Work | Assign a registered agent to perform a defined task using its permitted tools |
| Approval | Pause for a concrete action preview and explicit approval when required |
| Notify | Present the saved output in APEX; external delivery requires a configured destination and authorization |

Allow users to add and connect steps, assign agents, edit instructions, and inspect configuration. Provide click/select and keyboard alternatives to dragging. Include Save, Run, Cancel, and View result. Reject missing required inputs, unavailable agents/tools, invalid connections, and cycles in the first version. A “loop” initially means a reusable workflow; it must not silently create infinite execution or repeated external actions.

Each selected step displays the actual configured provider/model, memory access, permitted tools, inputs, output, and limitations. Keep Gemini as the project's selected provider unless changed explicitly. Do not copy the clip's model labels or imply every agent has tools merely because a card exists.

### Execute real workflows

Save workflow definitions with stable IDs, step IDs, connections, agent assignments, instructions, selected sources, and a version. Each run snapshots its definition so edits cannot silently alter work already underway. Run steps through the same persistent task manager and worker used for conversational background jobs.

For the first version, execute dependent steps in order. A later branching version can run independent branches within configured capacity, reserving capacity for foreground conversation. Show queued, running, waiting for input, waiting for approval, completed, failed, cancellation requested, and cancelled states from backend events. Display last verified progress, elapsed time, outputs, and useful errors. Use connection highlights only when the corresponding execution event is real.

A failed prerequisite blocks dependent work. Cancellation stops launching subsequent steps and attempts to stop current work where supported; show confirmed cancellation separately. Retrying a failed read must not repeat an already completed external action. On refresh, reload persisted state; on backend restart, reconcile interrupted steps before resuming. Retain the existing social publishing approval requirement.

### First usable workflow

Build a manual Weekly APEX Project Review using only project sources the user selects:

1. Trigger: user clicks Run.
2. Gather: retrieve selected build logs, decisions, open issues, and recorded milestones.
3. Work: Researcher summarises evidence; Strategist identifies blockers and next milestones; Chief of Staff assembles the review.
4. Notify: save and show the report in APEX, with references and missing-source notices. Announce completion when the current voice turn finishes.

The report covers HUD progress, chat/voice responsiveness, Gemini and any configured LiveKit integration, blockers, decisions needed, and next milestones. Missing sources must be reported rather than replaced with invented progress. Add scheduled execution later using Asia/Kuala_Lumpur and an explicit missed-run policy.

### Placement in the existing build stages

Add saved workflow definitions and sequential execution with the multitasking foundation in Phase 2. Add the canvas, inspector, and live step states in Phase 4. Bind assignments to verified specialist handlers in Phase 6. Add approval steps, schedules, and restart recovery in Phase 7. Preserve working chat, Gemini, microphone, and playback when integrating with the latest verified project build; the older Stage 2.1 archive is reference material, not proof of the current project's state.

### Additional completion gate

Save and run a workflow with a real connected source. Ask another question by text and voice while Gather or Work runs. Verify that chat responds, the canvas shows actual activity, and the result appears once. Refresh during execution and recover the correct state. Test a missing source, a failed step, cancellation, and a blocked approval. Edit the saved workflow while a run is active and verify that the active run retains its original definition. Record the results in the build log before marking this feature complete.


## Extended workspace reference — 1000130179.mp4

This additional recording is a required visual and capability reference for the APEX build. Reviewed scenes show a social command centre, comment triage with selection and drafted replies, a Personality Equalizer, a content composer, goal/metric tracking, and a command to open the social workspace on another screen. Visible UI and captions establish design targets; they do not verify the reference system's backend, platform permissions, or success of every displayed action.

### Social media command centre

Add a Social workspace linked to the Social Media Agent and loops engine. Show actual connected accounts, fetched comments, draft content, scheduled items where supported, and task history. Start with one connected platform and expand through supported integrations. Unconnected platforms are labelled Not configured; do not populate sample accounts, comments, follower counts, or successful sends as live data.

The composer lets the user select a supported platform/account, upload media, choose the supported post format, generate or edit captions, and preview the complete post. Preserve per-platform requirements and report unavailable features. Publishing or scheduling pauses for the existing human approval step with the account, media, caption, and timing visible. Confirm completion only from a verified platform response; save the returned post identifier and link when available.

### Comment triage and similar-comment replies

Read comments from authorized connected sources, keeping platform, account, post, author, original text, timestamp, and stable comment ID. Let users filter, inspect the source post, select comments, and request draft replies.

Group comments by similar intent to make repeated questions easier to review. Show why each group belongs together, allow removing incorrectly grouped comments, and keep questions with different context separate. Generate replies grounded in approved project/business information; do not invent links, prices, availability, or promises. Show the exact proposed reply for every selected destination, including any optional signature.

Support individual review and a batch approval preview with the selected comments, destination accounts, reply texts, and total count. After approval, send only that batch. Changed texts or added destinations require a new preview. Track per-comment outcomes so a partial failure does not resend successful replies. Mark a comment answered only when the external send is verified; distinguish reviewed, draft ready, approved, sending, sent, and failed. Respect the platform's access rules and rate limits. Grouping and drafting do not authorize automatic external replies.

### Personality Equalizer

Implement the existing requested controls: Sarcasm, Roughness, Directness, Warmth, and Push, each 0–100. Use an accessible settings panel with readable values, Reset, and a short preview. Save settings per user and apply them to conversational style and new draft generation. Do not silently rewrite already approved drafts. These controls change tone, not factual standards, tool permissions, or required approvals. Use this video for presentation direction; its small labels do not establish exact control names or values.

### Goals and measured progress

Provide goal cards with metric, connected source or explicitly labelled manual entry, baseline, target, deadline, last update, and progress history. Chart recorded measurements over time with source and date visible. Distinguish actual measurements from targets and projections. Never copy the clip's follower numbers into APEX as real data. Let Strategist and Analytics use these records for the weekly review and recommendations.

### Workspace navigation and another-screen support

Support text/voice requests such as “Open social media” by navigating to the corresponding APEX workspace without interrupting running jobs. A requested second-window mode can open a workspace after a user gesture. Exact positioning on another physical monitor is a separate Windows companion capability requiring a tested local integration; browser-only code must clearly report its limitations. Opening a panel does not authorize posting, replying, or changing an account.

### Build placement and verification

Add workspace navigation and Personality Equalizer in Phase 4. Add source-backed social drafts, comment grouping, and goal records with verified agent capabilities in Phase 6. Add approved publishing/reply batches, supported scheduling, and recovery in Phase 7. Keep these features connected to the same task manager, memory, and approval records as the main APEX assistant.

Acceptance checks: navigate by text and voice while a job runs; persist personality settings; compose a real draft from supplied media; group similar comments and remove a mismatch; review a concrete reply batch; verify one approved send and a partial failure without duplicate replies; chart genuine dated measurements; recover drafts and execution status after refresh. Record unavailable integrations honestly and leave their actions disabled until configured.

## Current package update — Stage 4.2

This package now includes the video-inspired compact system HUD, animated initialization,
real 12-item local diagnostics and optional browser dictation/read-aloud. The original archive
observations above remain historical. See README.md for microphone consent, silence submission,
Stop speaking, explicit resume, and the distinction between metadata access and generation.
See tests/VERIFICATION.md for actual checks and untested live Windows speech requirements.

## Stage 4.3 location dashboard

Clock/date, weather, Celsius temperature and location selection are now implemented.
See README.md for town search, browser location permission, device persistence, refresh and
stale-data handling. No location is inferred from old project notes; the user selects it.

## Stage 4.5 essential Focus mode

The clean view keeps clock/date, weather/temperature, a date-specific source-linked historical
event and actual APEX/local-runtime/voice state visible at upper left. Cyan/gold wave lines
pass behind the central core. Full workspaces remain available through Show dashboard.
