# Mark-LV backend review for APEX

Inspected on 11 October 2026. Source commit: `c3e795af71bff38bb406c62a2e7a63869cdc8eb2` in [FatihMakes/Mark-LV](https://github.com/FatihMakes/Mark-LV/tree/c3e795af71bff38bb406c62a2e7a63869cdc8eb2). Read-only checkout: `.apex-data/references/Mark-LV`. No reference code, installer, dependencies, Gemini calls or OS actions were executed.

This document records a source review and proposed implementation. It does not add these capabilities to the running assistant.

## Recommendation

Keep APEX's Next.js HUD, humanoid, chat, personality, 18-node map, Gemini model, Deepgram Flux and Fish Audio. Adopt Mark-LV's tool-dispatch design within APEX's authenticated Node runtime. Mark-LV is a Python/Qt application using Gemini, not a replacement set of model weights. Running its main application beside APEX would duplicate microphone capture, speech, UI and model sessions.

The largest current APEX gap is routing: `runtime/desktop-automation.mjs` handles recognized command forms, while conversational requests fall through to `runtime/provider.mjs`. That provider reads text parts, does not currently dispatch Gemini function calls, and can therefore answer with a mistaken refusal despite an available handler. More phrase rules help only the cases they cover. A shared registry and bounded function-calling loop address the underlying gap.

## Source-to-APEX mapping

| Source inspected | Actual implementation observed | Proposed APEX adaptation |
|---|---|---|
| [core/action_loader.py](https://github.com/FatihMakes/Mark-LV/blob/c3e795af71bff38bb406c62a2e7a63869cdc8eb2/core/action_loader.py) and main.py | Actions expose a TOOL dictionary with a name, description, parameter schema and handler. Discovery checks declarations and collisions; main dispatches model calls to registered handlers. | A backend-owned tool registry shared by model declarations, dispatcher, agent permissions and capability/status UI. Explicit registration of reviewed code rather than executing arbitrary dropped-in plugins. |
| [actions/web_search.py](https://github.com/FatihMakes/Mark-LV/blob/c3e795af71bff38bb406c62a2e7a63869cdc8eb2/actions/web_search.py) | Search, research, price, compare and news modes; Gemini Google grounding and DDGS fallbacks. General search tries Gemini first; news tries DDGS first. Grounding quota failures trigger a cooldown. | Separate search retrieval from opening a search tab. Add structured results with URLs, snippets, publication/fetch times and backend provenance. Integrate with Researcher. Keep current Brave adapter as an option; add a free search option. Grounding is opt-in and subject to the existing usage guard. |
| [actions/browser_control.py](https://github.com/FatihMakes/Mark-LV/blob/c3e795af71bff38bb406c62a2e7a63869cdc8eb2/actions/browser_control.py) | Native opening for basic navigation; persistent Playwright sessions for interactive operations, semantic element lookup, text extraction, typing, scrolling, tabs and history. | Build a general controller alongside APEX's verified YouTube controller. Use an owned profile and tab IDs; observe page state, select an unambiguous target, act, then verify the resulting URL, value, state or new content. |
| actions/computer_settings.py, computer_control.py, open_app.py, system_monitor.py | OS-specific settings and app launching, PyAutoGUI input, hardware/process information, and optional screenshot-to-Gemini coordinate targeting. | Add fixed Windows handlers and explicit receipts for volume, supported monitor brightness, window focus/minimize/maximize/snap, app discovery and diagnostics. Prefer Windows accessibility data over global blind clicks. Capability checks must report unsupported hardware. |
| [core/confirm.py](https://github.com/FatihMakes/Mark-LV/blob/c3e795af71bff38bb406c62a2e7a63869cdc8eb2/core/confirm.py) | UI-resolved pending confirmation with expiry; the model's parameters cannot confirm the action. | Extend APEX's existing exact-payload approval records to desktop and browser actions. Bind approvals to user/session, action, target and immutable parameters; expire and consume once. |
| core/undo.py | A session stack of reversal callbacks; settings restoration uses known previous values. | Persistent action journal with before/after data where reversible. Recheck ownership and current state before undo; never overwrite later edits or claim an external message was unsent. |
| core/gemini.py | Central request deadlines, cooldowns and an automatic model ladder. | Centralize failure handling and cooldowns. Preserve the selected model; alternate models require explicit configuration. Do not copy its automatic model switching into APEX. |
| main.py and action_loader.py | Runtime capability information, executor-based dispatch, and response scheduling metadata for nonblocking actions. | Derive assistant capabilities from registered/available handlers. Use APEX's existing background workers for long jobs and verified task status; allow conversation while a job runs. Completion notifications enter the speech queue at an appropriate pause. |

## Proposed execution path

```text
Deepgram Flux / Chat
        ↓
APEX authenticated API
        ↓
Clear command fast path OR existing Gemini request with relevant tool schemas
        ↓
Validate tool name + arguments + user intent + permissions + usage limits
        ↓
Registered Web / Browser / Windows / Integration handler
        ↓
Actual result + verification + timestamp + error
        ↓
Function response back to Gemini, if further planning is needed
        ↓
One final answer → existing history / HUD behavior / Fish Audio
```

The model selects from declared actions; it never supplies executable JavaScript, Python or shell commands. Simple media commands continue to run without an extra Gemini call. Natural instructions use function calls in the ordinary chat turn, then a limited number of execution/result cycles. Define a hard call cap, per-tool deadline, cancellation and duplicate-request IDs. Require missing critical details before acting.

Tool records should include ID, description, validated input schema, handler, owning agent, availability, required permissions, timeout, confirmation policy, verification strategy and optional undo operation. Example tool names: `web.search`, `web.read`, `browser.navigate`, `browser.read`, `browser.click`, `browser.fill`, `browser.tabs`, `youtube.play`, `youtube.fullscreen`, `system.apps`, `system.open`, `system.volume`, `system.window`, `system.diagnostics`.

## Important adaptations

Search results are evidence to inspect, not automatically verified facts. Read the relevant pages; include citations only to returned/read sources; distinguish snippets, grounded text and independently checked claims. Keep source provenance accessible in results/activity even when the compact HUD hides it. Search and extraction must reject private/local destinations, credentials in URLs, excessive responses and unsafe redirects.

Browser control must treat pages as untrusted data. Generic clicks, form filling and Enter can send, purchase, invite, delete or change settings, so permissions must cover the resulting action, not merely the tool's name. Do not automatically attach to personal logged-in browser profiles. Keep screenshots opt-in for sensitive pages; send to Gemini only when needed and authorized.

Do not transplant generated-code execution from `actions/desktop.py`: the source executes compiled model output in a restricted Python namespace. Also avoid shell-interpolated launch paths from `actions/open_app.py`. Some handlers report success after a spawn, click or keypress; APEX should retain its stronger distinction between submitted and independently verified results.

The reference's [LICENSE](https://github.com/FatihMakes/Mark-LV/blob/c3e795af71bff38bb406c62a2e7a63869cdc8eb2/LICENSE) states CC BY-NC 4.0. It is not MIT like APEX's stated runtime dependencies. Directly copied/adapted code needs appropriate attribution and the noncommercial terms must be considered before commercial distribution. Recommended approach: implement the general architecture independently in APEX; evaluate any proposed direct module reuse separately.

## Implementation order and acceptance checks

1. **Tool registry and Gemini dispatch.** Preserve deterministic command routing. Add structured function-call/result support, a bounded loop and live capability context. Mock provider calls to verify paraphrases, ambiguous input, malformed arguments, unknown tools, no-op/error handling, duplicate prevention, cancellation and action receipts. Live paid model tests require user approval.
2. **Web retrieval.** Wire `web.search`/`web.read` to Researcher with structured sources and extraction. Test actual public sources separately from fixtures; test missing configuration, rate limits, empty results and invalid citations. Avoid parallel paid fallbacks and silent provider changes.
3. **General browser sessions.** Extend the existing Playwright foundation to navigation, tab selection, reading, scrolling and semantic targets. Test against local fixture pages first. Verify multi-step read-only workflows on public sites, and block consequential form submission until approval.
4. **Windows controls.** Add a small fixed set of app/window/settings operations using the interactive desktop runtime. Use mocked contracts plus explicitly identified live tests. Verify supported settings by readback; require confirmation for system changes under the user's existing policy, and for restart/shutdown/network changes.
5. **Background coordination and journal.** Keep conversation available while jobs run, report only measured status, publish real node/edge events, persist receipts and implement checked undo where possible. Test restarts, stale approvals, interruption, handoffs and dependency failures.

Researcher owns retrieval; Engineering owns Windows operations; Chief of staff coordinates; Memory retains user-approved outcomes. The remaining node responsibilities and OAuth connections remain intact. A hosted Vercel HUD still needs a secure connection to a local runtime for desktop actions.

## Review outcome

Source and current APEX handlers inspected; documentation added only. No production handlers were replaced, no Mark-LV code was run, no keys were changed, and no billable tests were performed. First recommended implementation: shared tools plus Gemini function dispatch, followed by web retrieval and browser navigation/inspection.
