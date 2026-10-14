# APEX conversational voice pipeline

The current HUD, humanoid, agent map, chat, personality, task routing and voice IDs are preserved. The selected brain remains local Ollama `qwen2.5:3b`; recognition remains Deepgram `flux-general-en`, and speech remains the configured Fish Audio voice/model.

## Use it

Run `npm.cmd run launch` from the APEX folder after building with `npm.cmd run build`. Open http://127.0.0.1:3000/, open Conversation, and select Speak to APEX. Allow microphone access when the browser asks. The session stays open across replies, for up to five minutes. Speak again to interrupt the current response. Stop microphone, Stop voice session, or saying “stop listening” ends the session. Text chat and existing task controls continue to work.

Recognition audio goes to Deepgram and spoken reply text goes to Fish Audio. Starting a session is opt-in; a page reload never opens the microphone. Headphones are recommended for interruption accuracy. Browser echo cancellation and noise suppression are requested, but echo performance depends on the microphone, speakers and browser.

## Data path

1. Browser AudioWorklet captures mono 16 kHz PCM in 160 ms chunks. An authenticated local proxy relays bounded chunks into a persistent Deepgram WebSocket.
2. Flux Update events display transcripts. Only EndOfTurn submits a request. Indexed final events are deduplicated. StartOfTurn cancels the active reply and audio, allowing a new utterance while APEX is speaking.
3. The existing coordinator handles local commands and routes relevant tasks. Ordinary replies stream from Ollama through an authenticated NDJSON endpoint. Existing personality instructions and conversation history are retained; private thinking fields are never exposed.
4. Completed APEX replies now appear in the cinematic HUD overlay before speech starts. The canonical reply is divided into provider-sized chunks without rewriting or truncating it. There is one playing segment and at most one segment prepared ahead. Each segment is an MP3 generated with the existing Fish settings. This is chunk-based playback, not sample-by-sample Fish WebSocket audio. See [HUD responses](HUD-RESPONSES.md) for the updated sequence.
5. Playback continues to supply the existing HUD/humanoid audio levels. Idle, listening, thinking and speaking follow actual capture, request and playback activity. The panel displays measured first-text timing and approximate playback-start timing.

The session is continuous; a separate Flux connection is no longer opened after every reply. It ends on explicit stop, recognition failure, timeout or component teardown. Silent/interim input never starts a model request. No speculative eager generation is enabled.

## Cancellation and failures

Interruptions abort the browser stream, cancel server generation through its request signal, stop playback and discard queued/prefetched audio. Late tokens and audio cannot update a newer turn. An interrupted generated turn is not saved as a completed conversation reply. Text already delivered can remain visible and be labelled Interrupted.

A Fish failure stops additional speech preparation and ends the microphone session while allowing text generation to finish. The completed text remains visible with Voice unavailable. Request errors remain visible independently of SSE connection updates. Model or network failures display an error and stop continuous conversation; there are no hidden provider retries or paid fallback models.

Limits include one active conversational reply, 1,500 characters per Fish request, bounded PCM backlog, bounded streamed output, five-minute Flux sessions and existing model/API timeouts. The complete reply is retained for speech; long answers require multiple Fish requests. Segmenting can create more Fish requests than one-shot speech; no claim is made that it reduces provider billing.

Ollama supports incremental token streaming here. The existing Gemini adapter remains compatible but delivers a completed answer through the same transport; switching providers does not silently change the chosen model or use another service.

## Verification

- 165 automated tests passed, including provider token streaming, split UTF-8, incomplete/error streams, cancellation/history preservation, replacement-turn handoffs, sentence limits, ordered/prefetched speech, stale audio rejection, continuous Flux turns and duplicate final events.
- HTTP integration passed with an isolated database and missing Gemini credentials: stream content type, local-command completion and explicit error frames, plus existing permissions, loops and other endpoints.
- Production build/type checking passed.
- Real local Ollama/browser test completed; first text was measured at about 0.4 seconds on this machine for a short test request. This is one local observation, not a latency guarantee.
- Deepgram/Fish service tests use injected mocks. No paid recognition or synthesis test was run. End-to-end microphone/echo quality and Fish playback latency still require a live user session.

## Files

Added `lib/json-stream.mjs`, `lib/realtime-conversation.mjs`, `tests/realtime-conversation.test.mjs` and this guide. Updated `runtime/provider.mjs`, `runtime/engine.mjs`, `runtime/server.mjs`, `runtime/apex-voice.mjs`, `lib/runtime-proxy.ts`, `lib/flux-capture.mjs`, `components/useApexVoice.ts`, `components/HudWorkPanel.tsx`, `tests/apex-voice.test.mjs`, `tests/http.integration.mjs` and the mock browser fixture.

## Provider references

- [Deepgram Flux voice-agent turn handling](https://developers.deepgram.com/docs/flux/agent): EndOfTurn starts a reply; StartOfTurn supports interruption.
- [Ollama streaming](https://github.com/ollama/ollama/blob/main/docs/capabilities/streaming.mdx): REST responses stream incrementally.
- [Fish Audio real-time guidance](https://docs.fish.audio/resources/best-practices/real-time-streaming): latency/quality choices and streaming considerations. Existing synthesis settings were retained.
