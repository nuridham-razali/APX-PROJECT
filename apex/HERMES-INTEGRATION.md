# APEX Hermes integration

## Verified installation status — 8 October 2026

Official Hermes is installed in `.apex-data/hermes-agent`, pinned commit `0240fa4a84123406a0e5e6e7262e5b772b43f0bd`, with dedicated home `.apex-data/hermes-home`. Browser/computer packages were skipped. The authenticated capability/toolset probe passed and exposed only web_search/web_extract. DDGS search is installed; extraction uses Exa's anonymous keyless free tier, which is rate limited. No Fish, Deepgram or Gemini keys were copied to Hermes. Background model review and title upgrading were disabled.

The user authorised choosing and activating a compatible local model after live validation. **Qwen3.5 4B is now active with Hermes enabled and an actual 64000-token serving context.** Qwen2.5 3B remains installed for rollback. HUD, Deepgram, Fish voices and Gemini credentials were preserved.

PC: 16 GB RAM, Intel i5-12400, integrated UHD 730 graphics, Ollama 0.40.1. The downloaded [Qwen3.5 4B](https://ollama.com/library/qwen3.5:4b) allocated 5574240500 bytes (about 5.2 GiB) at 64K. Initial short generation took 9.4 seconds; warmed repetitions took about 1 second. Actual search, page extraction and final answer completed in **64.6 seconds**. These are individual measurements, not guaranteed timings; large documents and other applications can increase latency and memory pressure.

Configuration is now `OLLAMA_MODEL=qwen3.5:4b`, `APEX_HERMES_CONTEXT_LENGTH=64000`, `APEX_ORCHESTRATOR=hermes`. The helper validates the installed model context before enabling Hermes. Start Ollama, then run `npm run runtime`, `Start-Hermes.bat`, and `npm run start` in separate terminals. Open http://127.0.0.1:3000/. For rollback, set `APEX_ORCHESTRATOR=direct` and `OLLAMA_MODEL=qwen2.5:3b` in private `.env.local`, then restart APEX runtime and frontend.

Verification: all **229 automated tests passed**; production build passed. The isolated live test performed actual 64K local inference, web_search, web_extract and final-answer generation and checked successful tool receipts. Report: `.apex-data/hermes-model-validation.json`. Production runtime/Hermes/frontend restarted, authenticated production probes passed and all 18 nodes remain. Physical microphone and Fish playback were not tested; no paid API calls were made. Initial tool-history conversion and extraction configuration failures were fixed. Failed tool execution now blocks a successful final answer unless that tool subsequently succeeds.

APEX remains the user interface, authenticated backend, voice controller and owner of conversation history. The opt-in HermesAdapter submits durable `/v1/runs` to the authenticated Hermes API and consumes real tool lifecycle events. Only the completed final answer enters the existing chat/history/Fish Audio pipeline. NOVA, wake acknowledgements, personality commands, native Memory/CRM/Analytics, diagnostics, connected email/calendar/drive and authorised Developer tools retain their existing handlers. Existing recurring Loops retain their budgets and exact-action approvals; they are not replaced by unbounded Hermes loops.

## Current supported permission profile

Only `web_search` and `web_extract` are accepted. Hermes' API platform must have an explicit read-only toolset selection. Unknown tools block dispatch. The local model gateway also rejects unapproved tool declarations and unapproved generated tool calls before returning them to Hermes. Approval requests from Hermes are denied, with an actual denial event. Terminal, browser actions, file operations, publishing, delegation, skills execution and Hermes memory writes remain blocked. Their future activation needs scoped execution enforcement, exact-action approval and isolated tools; an instruction in a prompt is not enough.

APEX's own persistent memory is unchanged. Hermes sessions are isolated per admitted request and receive APEX's saved conversation history explicitly. This does not yet implement a shared Hermes long-term-memory or skill store. The agent map records Chief of staff orchestration and Researcher web-tool receipts; it does not invent activity on the other roles.

## Configuration

1. Install the official Hermes Agent using its [Windows instructions](https://hermes-agent.nousresearch.com/docs/user-guide/windows-native). Use a dedicated home/profile for APEX with no paid provider credentials, no fallback providers and no MCP servers or plugins.
2. Start the APEX runtime using `npm run runtime`. It creates a separate model-gateway token in `.apex-data/hermes-model-token`. Keep this token private; it cannot authenticate APEX administrative routes.
3. Configure Hermes' custom OpenAI-compatible provider with the selected APEX model (`qwen3.5:4b`), base URL `http://127.0.0.1:8081/hermes/model/v1`, and the private model-gateway token. Do not point this integration directly at Ollama's `/v1`; that bypasses the APEX call budget. Keep auxiliary models on the same local gateway, disable title upgrading and remove all fallback providers.
4. In Hermes' private `.env`, set `API_SERVER_ENABLED=true` and a newly generated `API_SERVER_KEY`. In its `config.yaml`, explicitly select `platform_toolsets.api_server: [web, no_mcp]` (or `[]` for conversation only). Verify the live `/v1/toolsets` reports only web_search/web_extract. Extra tools cause APEX to fail closed. Web tools need their supported configured search/extraction backend; missing credentials are not successful research.
5. In APEX's private `.env.local`, add:

```dotenv
APEX_ORCHESTRATOR=hermes
APEX_HERMES_URL=http://127.0.0.1:8642
APEX_HERMES_API_KEY=THE_SAME_PRIVATE_HERMES_API_SERVER_KEY
APEX_HERMES_TIMEOUT_MS=180000
APEX_HERMES_DAILY_CALL_LIMIT=100
APEX_HERMES_CONTEXT_LENGTH=64000
```

Keep APEX_PROVIDER, Gemini settings, Deepgram and Fish settings unchanged. OLLAMA_MODEL is now qwen3.5:4b. Restart APEX runtime and start `hermes gateway` in the dedicated Hermes profile. The [official API guide](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server) documents API authentication, runs, cancellation and toolset discovery.

6. Open `/api/runtime/hermes/status` through APEX to run read-only connection checks. This does not generate an LLM response. The network panel shows Hermes status whenever the adapter is enabled. Set `APEX_ORCHESTRATOR=direct` and restart the runtime to return to existing execution.

## Limits and evidence

- Only local Ollama inference is allowed by the model gateway. Paid providers are blocked until an explicit per-call spending guard is integrated. Each local model attempt reserves one call before network execution, including failed attempts, with a UTC-day cap. Tool-provider billing is separate; configure free/local web backends if required.
- Hermes must actually route all main/auxiliary calls through this gateway. Keep its dedicated profile free of remote credentials. APEX checks the final served provider/model receipt, but a receipt alone cannot prevent a separately misconfigured Hermes service contacting another provider.
- Hermes uses Qwen3.5 4B at 64K; native APEX handlers and NOVA retain their existing 8192-token direct context. Switching contexts can reload the model and add latency. One successful research workflow does not establish reliability for every task. No paid fallback happens automatically.
- APEX stores run IDs, status, timestamps, final output, returned usage and sanitized tool lifecycle metadata. Private reasoning, raw tool arguments and unredacted previews are not copied into the HUD.
- Identical in-flight request IDs share one admission; admission uses Hermes' durable Idempotency-Key. Ambiguous admission or failed stop is journalled as unknown, without automatic redispatch. After a crash, inspect the saved run before explicitly retrying.
- APEX cancellation and timeouts request Hermes `/stop`. A stop request is not proof that an external action was reversed. This read-only profile has no authorised external writes.
- Browser capture, Fish playback and fading continue to use their existing actual events. Hermes tool events do not fabricate SPEAKING or LISTENING.

## Changed files and verification

New backend modules: `runtime/hermes-adapter.mjs`, `runtime/hermes-model-gateway.mjs`, `runtime/configure-hermes.mjs`, `Start-Hermes.bat`. Existing integration points: `runtime/engine.mjs`, `runtime/server.mjs`, `lib/runtime-proxy.ts`, `components/runtime-types.ts`, `components/ApexReasoningNetwork.tsx`, `components/apex-reasoning-network.css`, `.env.example`. Private `.env.local` selects the validated model and enables Hermes. Tests: `tests/hermes.test.mjs`, `tests/hermes-model-live.integration.mjs`. The full suite also revealed a repeated wake-only phrase regression; `lib/wake-phrase.mjs` now handles “Apex, Apex.” locally. Existing node/function inventory remains in `docs/18-NODE-DELIVERY.md`.

Run `npm test` and `npm run build`. Hermes test cases are explicitly MOCK tests: admission, events, final output/history, cancellation, model mismatch, tool permission denial, duplicate protection, inference budget and NOVA preservation. They do not verify a live Hermes installation, web backend or physical microphone. Live model requests require a separate explicit test; paid tests require approval.
