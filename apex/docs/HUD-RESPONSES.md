# Cinematic APEX responses

The main HUD now presents completed assistant responses in a cyan/white conversational overlay at the lower left. The orb, reasoning web, navigation and humanoid remain intact. Fish Audio and the selected voice are retained, as requested; no ElevenLabs configuration was introduced.

## Use

Open http://127.0.0.1:3000/. The **Speak to APEX** control on the main HUD starts the existing continuous Deepgram session without opening Conversation. Stop it with the same control or the existing voice controls. Conversation remains available for persistent messages. Closing that panel or opening Tasks does not unmount the conversation voice pipeline.

Typed and spoken replies use the same path. Tokens can still populate Conversation as they arrive, but the HUD waits for the completed canonical reply. It fades in over 180 ms before speech preparation starts. The exact response is used for HUD text, conversation history and TTS. Replies longer than the provider's 1,500-character request limit are divided without dropping or rewriting characters; they are played in order. Long text is scrollable in the overlay. Markdown is preserved in all three paths rather than silently stripping it only for speech.

The completed-response sequence intentionally replaces early sentence playback for APEX chat: the full HUD answer is displayed first, then spoken. There is no eight-segment or 1,500-character total speech truncation. Long replies therefore require more TTS requests. Cancelling speech discards pending segments rather than claiming that the entire reply was spoken.

The overlay remains visible throughout synthesis and playback, then holds for three seconds after actual playback completes. A 1.2-second fade follows. Text-only replies and failed speech also hold and fade; a failed TTS request never produces a Speaking animation. Speaking begins only after browser audio playback starts. During continuous voice, the assistant resumes Listening; the overlay's hold does not fabricate an audio state. A replacement response cancels the previous timer, and late completion events cannot hide the replacement.

Actual loop announcements and system-check reports also appear with their existing text. Status messages, animation previews, and voice-test phrases are not presented as generated assistant replies. The optional user transcript overlay was not added; existing recognition transcripts remain available in Conversation.

## Changed files

- Added `lib/hud-response.mjs`, `components/HudResponseOverlay.tsx`, `components/hud-response-overlay.css` and `tests/hud-response.test.mjs`.
- Updated `components/HudPreview.tsx`, `components/HudWorkPanel.tsx`, `components/useApexVoice.ts`, `components/nova/useNovaAudio.ts`, `components/ApexSystemCheck.tsx`, and `runtime/fish-voice.mjs`.
- Extended `tests/humanoid-ui-fixture.mjs` with mock audio and TTS request receipts. Every API in that proxy remains isolated from real providers.

## Verification

170 automated tests passed, including hold/fade timing, replacement during fade, stale audio completion, disposal, cancelled reveal, Unicode chunk boundaries and exact text sent through mocked Fish requests. HTTP integration and the production build/type check passed.

Browser checks use an explicitly mocked response and a generated WAV tone, with no paid service calls. They verify Speaking during real browser playback, display with Conversation closed, persistent conversation after fading, and failed speech without a false Speaking state. A separate real local Ollama check verifies the HUD receives an actual model reply; speech is disabled for that check. Deepgram/Fish end-to-end microphone and synthesis quality still requires a live user session.

## Start again

From the `apex` directory, run `npm.cmd run runtime` and `npm.cmd start` in separate terminals. Run `npm.cmd run build` before `start` when source changes. Keep API keys in the private backend `.env.local` file.
