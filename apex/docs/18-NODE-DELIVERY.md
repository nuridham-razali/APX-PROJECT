# APEX 18-node update

For the current 11 October implementation, live validation and Gmail/Google Calendar/Drive setup, see [NODES-FUNCTIONAL.md](NODES-FUNCTIONAL.md). The details below document the original node-map delivery.

The authoritative visual source is [ApexWorld.tsx](https://github.com/RubenM1990/APEX-UI/blob/main/components/ApexWorld.tsx) and [ReasoningWeb.jsx](https://github.com/RubenM1990/APEX-UI/blob/main/components/ReasoningWeb.jsx). Downloaded audit copies are `ApexWorld.reference.tsx.txt` and `ReasoningWeb.reference.jsx.txt`. The map uses the original names, colours, coordinates, core clearance rule, curved spokes, nearest-neighbour connections, concentric rings and outer circuitry. The original demo's “online” labels are replaced with local execution evidence. Engineering follows Idham's revised IT role; Developer implements authorised source reading and patch preparation rather than the reference's future-only capability.

`lib/node-registry.mjs` is shared by the map, workflow agent list, router and backend status. Its 18 entries define purpose, tools, permissions, expected outputs and source layout. `runtime/agent-execution.mjs:executeNode` dispatches every node; `runAgentTask` executes relevant steps and passes actual outputs between them. The separate legacy bounded text-loop path is preserved for NOVA and explicit `/loop` requests.

| Node | Handler / tools | Useful result | Limits / required access |
| --- | --- | --- | --- |
| Chief of staff | Deterministic router; selected-model synthesis; memory.read | Selected steps and one coherent answer | Only relevant roles run; no model routing call; at most four specialist roles |
| Memory | SQLite read/save/edit/delete | Provenance-labelled facts and unfinished tasks | Save/correct by explicit request; deletion requires an exact one-use approval |
| Strategist | Selected model; memory.read | Roadmap, priorities, milestones, risks | No fabricated milestones or silently changed saved decisions |
| Researcher | Supplied sources, authorised project reads, optional Brave search | Cited evidence summary | Live search needs backend BRAVE_SEARCH_API_KEY; disclosed as unavailable otherwise |
| Finance | Validated numeric line-item calculator; selected-model analysis | Income/expense/net receipt or analysis | No currency conversion or invented numbers; textual model arithmetic is labelled unaudited |
| Editor | Role-specific selected-model instructions | Revised draft and unsupported-claim notes | Preserves meaning; does not send or publish |
| Sales | Selected model; real SQLite CRM read | Proposal, quotation or follow-up draft | Sending is separate; recipient and message must be reviewed |
| Marketing | Selected model; measured local analytics; routed collaborators | Campaign, positioning, content plan | External-channel analytics unavailable without another adapter |
| Ops | Selected model; actual task and CRM records | Operational checklist, deadline/blocker plan | Saved workflows run manually; recurring scheduling is not connected |
| Social | Selected model; relevant Design/Editor collaboration | Caption, post, script, schedule draft | Social publishing adapter not connected |
| Engineering | Real OS CPU sample, RAM, filesystem capacity, network interfaces, process health; selected-model interpretation | Measurements, limits and proposed IT fixes | GPU/temperature sensors, DNS traces, service controls and settings changes not connected |
| Design | Selected-model visual brief/layout/palette instructions | Visual brief and recommendations | Image generation/editing tool not connected |
| Developer | Authorised text reads, isolated patch artifact, approval-gated copied test workspace; selected-model code review | Code proposal, patch.json, actual permitted-test receipt | No automatic patch application/deploy/destructive command; copied workspace is not an OS security sandbox |
| Analytics | SQLite task/turn metrics | Completion/failure counts, measured durations and coverage | No external campaign analytics; no invented timing for unrecorded tasks |
| CRM | Real persistent SQLite lead read/save | Name, deal stage, notes, follow-up date records | Local CRM explicitly identified; no external CRM provider claimed |
| Calendar | Microsoft Graph upcoming calendarView read | Actual events with a 7-day/30-item scope | Backend delegated OAuth token and Calendars.Read; invites/shared-event writes not implemented |
| Email | Microsoft Graph latest-message read; approval-gated sendMail | Actual messages or a sending-request acceptance receipt | Mail.Read / Mail.Send; sender must review exact recipient, subject and text; HTTP 202 means accepted, not confirmed delivery |
| Drive | Google Drive file metadata read | Actual names, types, dates and links | Backend OAuth and drive.metadata.readonly; document-content export, sharing/deleting/organisation not implemented |

Every node retains its source visual style, including source dashed nodes; dashes no longer claim whether credentials are configured. Status is shown explicitly: Idle, Queued, Working, Completed, Failed, Not configured or Unavailable. Quick transitions are retained as bounded persisted events so polling does not erase them. A working node has a distinct pulse; source decoration is not an execution claim. Actual handoffs animate the relevant connection. Node details show capabilities, connection state, task, progress, tool summaries, result and errors, never private chain-of-thought.

The graph has zoom, pan, reset, a keyboard-accessible 18-node list and hide/show. The full overview stays visible with a translucent background and no expand/collapse control. The core remains clear of connections. Original chat, microphone and Fish Audio selectors remain in their existing flows.

The provider persona instructions in `runtime/provider.mjs` now describe only receipt-backed tool availability; provider selection, model IDs and voice settings are unchanged.

## Configuration preserved

Inspection found `APEX_PROVIDER=ollama`, local `qwen2.5:7b`, Gemini model `gemini-2.5-flash-lite`, **no Gemini key**, and existing Fish Audio configuration. No private setting was edited. The existing Gemini adapter is reused when the user selects it; no alternative model or paid fallback is introduced. Live Gemini role validation is blocked by the missing key and approval for billable testing. Credentials remain backend-only.

Email/Calendar require `APEX_GRAPH_ACCESS_TOKEN` with appropriate delegated Microsoft Graph scopes. Drive requires `APEX_GOOGLE_ACCESS_TOKEN`. These tokens expire; this build does not include an OAuth login/refresh UI. Researcher's optional live search requires `BRAVE_SEARCH_API_KEY`. Do not enter credentials in the node JSON input or share them in chat. Set them privately on the backend, then restart the runtime. No account was connected or permission granted during implementation.

## Examples

Click a node, type its task and optionally open Structured tool input. All inputs below are explicit user requests; model output cannot create approval tokens or executable tool inputs.

Finance, “Calculate these supplied amounts”:
```json
{"items":[{"type":"income","amount":100},{"type":"expense","amount":35}]}
```
Memory, “Remember this preference”:
```json
{"operation":"save","text":"My preferred accent is cyan."}
```
Memory correction: `{"operation":"edit","id":"saved-record-id","text":"corrected fact"}`. Deletion: `{"operation":"delete","id":"saved-record-id"}`. Deletion only queues after reviewing the exact displayed fact and pressing Approve displayed action.

CRM, “Store this lead”: `{"operation":"save","name":"Client A","stage":"proposal","notes":"Awaiting feedback","followUp":"2026-10-12"}`. `id` updates an existing record.

Developer, “Review these authorised sources”: `{"files":["runtime/engine.mjs","runtime/inference-scheduler.mjs"]}`. Secret/configuration/database directories, traversal, symlinks outside the project and unsupported/big files are denied. The model sees bounded source excerpts, labelled when truncated. `{"patches":[{"path":"lib/example.mjs","content":"proposed complete file content"}]}` prepares a JSON patch artifact under the private data directory; original files remain unchanged. `{"operation":"tests"}` requires explicit approval and executes only the fixed Node test suite in a copied workspace, with provider credentials omitted.

Email, “Prepare this sending request”: `{"operation":"send","to":"recipient@example.com","subject":"Review","text":"Exact message to send"}`. Requires configured access, exact content approval and a fresh approval for any retry. No attachments, recipient guessing or automatic retries.

“Check why my assistant is slow” routes Engineering → Analytics → Developer → Chief of staff. Actual measurements and prior results are passed between handlers. Memory stores measured diagnostics with provenance; model interpretations are not saved as confirmed facts. General conversations remain available while background work runs.

## Sound and diagnostics

The old bass-drop effect is replaced by an original short electric sweep, soft impact, airy tail and delayed resonance. Research used the published descriptions/durations/licences of [Energy Pulse 2](https://freesound.org/people/SilverIllusionist/sounds/673555/) and [NexaWave](https://pixabay.com/sound-effects/film-special-effects-cinematic-designed-sci-fi-whoosh-transition-nexawave-228295/). These recordings were not downloaded, auditioned or reused; all effects remain local Web Audio synthesis.

Fade → core → brighter ring → branching connections → nodes → outer tracks → flowing waves → halo/shockwave → chirps → held completion is preserved. Effects are volume/mute controlled and duck to 20% during actual Fish Audio speech. The shockwave now uses the user's supplied original Tripod horn and overlapping bass tail; see `HUMANOID.md` for the source adaptation and the new optional face view. Plasma uses the upstream curve geometry with cyan/gold colour alternation and larger white travelling highlights; the system-check cyan-only override was removed.

Diagnostics now have 18 scoped rows, a per-check timeout, explicit skipped/unverified transport checks and optional actual configured-service read checks. They do not spend quota on model generation, Fish Audio synthesis or microphone tests. Completion waits for every result or timeout; a successful checkmark requires a nonempty, completed, all-passed report. Failed, skipped or untested rows produce a warning badge. The presentation timeline and backend diagnostic timing are separate.

## Verification

- Automated suite: 119 tests passed, including one relevant task for every node. Model outputs are mocked in these tests; real SQLite operations, arithmetic, OS inspection, authorised fixture file reads, isolated patch writes and handoff records execute. Missing integrations return explicit unavailable results.
- Source audit test compares all 18 layout tuples directly against the downloaded upstream roster.
- Cloud adapter tests use mocked HTTP responses, including rejection paths and accepted-versus-delivered distinctions. They are not live Outlook/Drive/search tests.
- Real local HTTP integration passed for authentication, same-origin protection, state/SSE, missing-provider configuration, memory/recall, native Finance calculation, pending deletion confirmation and forged-approval rejection. No cloud model request is made.
- Production build passed. Browser verification checks the complete map, native task updates, controls and system-check warnings. Live Gemini/Outlook/Drive/search tests remain blocked by missing credentials and/or approval; they are not reported as passed.
- The actual Developer copied-workspace test runner also passed: 16 permitted test files, real process exit code 0, no provider credentials passed. The live Finance UI returned a real 100 − 35 = 65 calculation and Completed state. Live diagnostics returned 12 passed / 6 unverified and correctly showed a warning badge; Fish Audio was disabled for this verification run.

## Changed files and running

Registry: `lib/node-registry.mjs`. Execution: `runtime/agent-execution.mjs`, `runtime/node-tools.mjs`, `runtime/engine.mjs`, `runtime/server.mjs`, `runtime/diagnostics.mjs`, `lib/runtime-proxy.ts`. UI: `components/ApexReasoningNetwork.tsx`, `ReasoningWeb.jsx`, `apex-reasoning-network.css`, `runtime-types.ts`, `HudPreview.tsx`, `HudWorkPanel.tsx`, `WorkflowWorkspace.tsx`, `ShaderBackground.jsx`, `ApexSystemCheck.tsx`. Effects: `lib/system-check-sounds.mjs`, `lib/check-presentation.mjs`. Verification: `tests/nodes.test.mjs`, `tests/runtime.test.mjs`, `tests/system-check.test.mjs`, `tests/diagnostics.test.mjs`, `tests/http.integration.mjs`. Documentation includes this file and the two audit source copies.

Open two PowerShell terminals in `C:\Users\Win11\Documents\ChatGPT\New project\apex`:
```powershell
npm.cmd run runtime
```
In the other terminal:
```powershell
npm.cmd run build
npm.cmd start
```
Open `http://127.0.0.1:3000`. Use **18 NODES** to inspect all roles, **Run task** in a node card, or the existing Chat/Tasks controls. Run verification with `npm.cmd test` and `npm.cmd run verify:http`. Do not run old live voice/model scripts without separately approving those API calls.
