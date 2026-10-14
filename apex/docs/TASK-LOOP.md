# APEX / NOVA task execution loop

The first closed loop handles text work on supplied material using the existing Gemini provider. Open **Tasks** from the main HUD, enter a goal, optionally expand **Add source material**, then choose **Start task**. The separate legacy workspace screen is removed; `/workspace` redirects to the HUD. Chat also supports `/loop` followed by a goal and supplied material. Ordinary chat is not automatically routed into a task.

1. Persist the request and source in the local task queue; immediately return a task receipt.
2. Plan one to four steps using registered text agents only. Validate the plan before execution.
3. Execute each step against the original source and previously accepted outputs.
4. Check the result against one to three explicit acceptance requirements. A failed check allows one revision, followed by another check.
5. Stop for review if the second check fails or if information/connectors are missing. Downstream steps remain blocked. Provider errors do not trigger automatic paid retries.
6. Save accepted outputs, review feedback and attempt counts. Report completion in Tasks; NOVA also shows status notices after foreground conversation/audio finishes.

The limit is four steps, two attempts per step, and seventeen provider calls per run. Reviews are model judgments about supplied text, not independent verification of real-world facts or external execution. No shell, browser, desktop or messaging handler exists in this loop. Plans requiring those actions stop rather than silently substituting drafts.

Cancellation aborts the active provider request and retains partial drafts without marking them accepted. Restarted, interrupted work requires review and an explicit new run. Retry preserves the goal and source but creates a new ID and plan; it never resumes an uncertain provider call. If material was missing, supply an amended goal/source in a new task instead of retrying unchanged input.

Set your private `GEMINI_API_KEY` in `.env.local` and restart the runtime to enable live execution. The UI reports missing configuration and disables starting work. Never put keys in chat or source material. Deepgram Flux/Fish Audio remain a separate voice milestone.

Validation: `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run verify:http`. Task-loop fixtures cover plan validation, result review and bounded repair, cancellation, unavailable actions, provider failure, independent foreground conversation, call limits and `/loop` receipts. Fixtures make no paid requests.
