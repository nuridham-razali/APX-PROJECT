# Hands-free input and spoken-word HUD

The HUD now shows only the user's recognised speech (`YOU / VOICE`). Leading Apex wake phrases are removed. Interim transcripts update the same overlay; assistant replies and background results cannot replace it. It holds through the reply, then fades after three seconds plus a 1.2-second transition. No transcript-editing box appears on the HUD. Manual send remains available when browser hands-free is disabled.

APEX replies remain in Chat. With English read-aloud enabled, new response text is revealed after the browser's actual audio.play() promise resolves, not when synthesis is requested. A failed speech request reveals the text with the error, without claiming that playback occurred. Text-only replies remain immediate. Existing history persistence remains enabled; stored original responses are retained.

Shared spoken-text formatting removes Markdown headings, emphasis, bullet markers, backticks and link destinations. Meaningful punctuation, numbers, currency and identifiers remain. APEX applies it before chunking and Fish applies it defensively on the backend. NOVA's Fish settings and voice are unchanged.

The HUD exposes a voice-input selector. Explicit selections persist under apex.voice-input and restore without starting the microphone. Browser mode still requires consent when on-device processing cannot be verified. Deepgram Flux uses the existing private configuration. Enable MIC once, wait for LISTENING, speak and pause; leave MIC enabled. OFF ends the session rather than submitting speech. Actual completion resumes an enabled hands-free session.

Browser final recognition results now release a stuck speech-activity flag when speechend is omitted. A new speech-start event still cancels the inactivity deadline. No fabricated transcripts or assistant answers are introduced.

Changed files: components/HudWorkPanel.tsx, components/BrowserVoiceHud.tsx, components/browser-voice-hud.css, components/useApexVoice.ts, components/HudResponseOverlay.tsx, components/nova/useNovaAudio.ts, lib/browser-voice-session.mjs, lib/hud-response.mjs, lib/spoken-text.mjs, runtime/fish-voice.mjs, tests/browser-voice-session.test.mjs, tests/hud-response.test.mjs, tests/humanoid-ui-fixture.mjs.

Validation: 203 automated tests passed, including missing speechend, new-segment cancellation, wake handling, microphone OFF, playback ownership, transcript-only HUD boundaries, fade lifecycle, and formatting preservation. Production build/type checking passed. Earlier in this task the mock browser verified automatic submission without speechend and actual synthetic audio playback. Final browser visual verification could not be completed because its current error-page protocol was blocked by browser security policy. No live microphone, Deepgram, Fish Audio or paid model test was run. Configuration readiness is not proof of live service authentication or microphone operation.

Run from the apex project: npm.cmd run runtime and npm.cmd start (after npm.cmd run build). Open http://127.0.0.1:3000/. Select Deepgram Flux for the existing Flux integration; enable MIC explicitly and grant browser microphone permission yourself.
