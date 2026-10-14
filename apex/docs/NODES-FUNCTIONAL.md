# Current 18-node execution inventory

Updated 11 October 2026. Names, colours, source positions and connections are preserved in the shared registry. The UI now offers a reviewed example task for each node. Loading an example performs no work; Run task submits it. Specialist tasks are no longer replaced by generic Hermes orchestration.

| Node | Actual handler and tools | Output / limits |
| --- | --- | --- |
| Chief of staff | `routeNodes`, relevant handlers, selected-model consolidation | Relevant steps and one answer; external actions require separate exact approval |
| Memory | Persistent SQLite save/read/edit; approval-gated delete | Facts with provenance and unfinished tasks; no automatic training claim |
| Strategist | Selected local model plus saved Memory records | Roadmaps, options and risks; assumptions labelled |
| Researcher | Hermes web_search/web_extract, or configured Brave; authorised project reads | Source-linked findings; actual failed tools block success |
| Finance | Validated line-item calculator, selected-model analysis | Actual income/expense/net receipt; no invented missing figures |
| Editor | Role-specific local inference | Revised draft and unsupported-claim notes |
| Sales | Saved CRM records plus local inference | Proposal/follow-up draft; never auto-send |
| Marketing | Recorded Analytics plus relevant routed roles | Campaign/positioning/content plan; no invented external metrics |
| Ops | Persistent SQLite checklists, task/workflow/Loops reads, local inference | Saved checklists, current blockers, operational plans |
| Social | Local inference and relevant Design/Editor roles | Draft captions/scripts; social publishing unavailable |
| Engineering | Real OS CPU sample, RAM, disk and network-interface measurements | IT findings and proposed fixes; no unconnected sensors or system-setting changes |
| Design | Local inference | Visual briefs/layouts/palettes; image generation is not connected |
| Developer | Authorised files; model-proposed isolated patch; approval-gated copied test workspace; development log | Review/proposal or actual receipt; original files and deployment remain unchanged |
| Analytics | Recorded SQLite task/turn metrics | Counts, rates, recorded timings and coverage |
| CRM | Persistent lead records and explicit interaction history | Local clients/stages/follow-up data; not an external CRM connection |
| Calendar | Google Calendar date-window read and overlap checks | Actual returned events and timed overlaps; account connection required |
| Email | Gmail search/message reads, optional local draft/synthesis; exact-approval send | Returned messages, saved unsent draft, or accepted send receipt; never inferred delivery |
| Drive | Google Drive search/metadata; Google Docs/text export | Returned files and supported document text; account connection required |

Google nodes currently need the owner's OAuth app and sign-in: see [GOOGLE-CONNECTION.md](GOOGLE-CONNECTION.md). No account access or credentials can be supplied by guessing. Google handlers were tested with mocked HTTP contracts; missing-credential behavior is real. Calendar invitations/shared-event changes, Drive sharing/deletion, social publishing, system-setting changes, and deployment actions remain disabled. Read permission does not authorise those actions.

Specialists use the selected Qwen3.5 4B model and their own instructions. Only Researcher uses Hermes's enabled web tools within an agent-map workflow. Existing foreground Hermes chat and NOVA's pipeline are preserved. Routing orders research/measurements before dependent work and sends actual results through handoff events. A clicked Chief of staff node can route specialists and return their consolidated result.

## Additional tool inputs

- Ops saved checklist: `{"operation":"save","name":"Launch","items":[{"text":"Review draft","done":false,"due":"2026-10-15"}]}`. Read with `{"operation":"read"}`; update using the saved record's `id`.
- CRM interaction: `{"operation":"interaction","id":"SAVED_LEAD_ID","text":"Client requested a proposal"}`. This records a user-supplied fact; it does not contact the client.
- Developer model-proposed patch: `{"operation":"patch","files":["lib/example.mjs"]}` with an actual authorised small source file and a task describing the change. Produces an isolated patch artifact and refuses truncated source or unapproved output paths.
- Developer log: `{"operation":"log"}`.
- Email draft: `{"operation":"draft","query":"in:inbox from:client@example.com"}`. Reads connected messages and saves an unsent local draft; recipient/content review is separate.
- Email/Calendar/Drive readable synthesis: add `"summarize":true` to a read input. Summary uses the actual read receipt and the existing selected model.

## Verification and running

Verification on 11 October: 239 automated tests passed. The real local per-node run completed 15 handlers; the 3 Google nodes were blocked by missing credentials. Saved outputs were checked against actual persistent tasks and node completion receipts. The live harness's cleanup hook was corrected after results were saved. Google HTTP tests use mocks, not a signed-in account. No paid voice/model requests or external messages were sent.

`npm test` checks all handlers, routing/handoffs, real SQLite/arithmetic/OS tools, isolated patches, one-use approvals, unavailable integrations, mocked Google OAuth/read/send contracts and privacy. `npm run build` checks the UI. `node tests/nodes-live.integration.mjs` is an explicitly live local-model test, with private isolated storage and one relevant task per node. It refuses paid models and does not invoke Fish/Deepgram or send real email. Its report distinguishes completed nodes from blocked Google integrations; it is not a successful live Google test.

Restart `npm run runtime` after backend/environment changes; keep Ollama and `Start-Hermes.bat` running. Run `npm start`, then open http://127.0.0.1:3000/. The Vercel deployment remains HUD-only and is not redeployed by this work.

Changed files: shared node registry, agent execution, engine, tool adapters, diagnostics, node details UI, private integration-provider selection and example environment file. New files: `runtime/google-tools.mjs`, `runtime/connect-google.mjs`, Google setup guide, Google contract tests, live node harness and this inventory.

Google API contracts follow the official [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail sending guide](https://developers.google.com/workspace/gmail/api/guides/sending), [Calendar event-list API](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), and [Drive download/export guide](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
