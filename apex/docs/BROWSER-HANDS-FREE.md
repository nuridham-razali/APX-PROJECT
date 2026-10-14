# Optional browser hands-free voice

APEX now offers Browser SpeechRecognition alongside the existing Deepgram Flux input. Browser mode is the initial selection, starts with **MIC ● OFF**, and never requests microphone access on startup. Choose the input method in Conversation. Fish Audio remains the only TTS provider; the existing Ollama/Gemini configuration, voice ID, backend credentials, HUD response overlay and conversation persistence are retained.

## Start

Use the main HUD's **MIC ● OFF** button. APEX checks browser support and on-device capability first. If `SpeechRecognition.available({langs:['en-US'],processLocally:true})` reports availability and the instance supports enforcing `processLocally`, APEX selects that local implementation. It never silently falls back from a failed local recognizer to an online one. It does not download language packs automatically.

If the browser cannot confirm on-device processing, the microphone remains OFF and the HUD shows the privacy notice. Choose **CONTINUE WITH BROWSER SPEECH** to permit this browser's recognition service or **KEEP MICROPHONE OFF**. APEX cannot identify a remote processing destination through this API and does not claim remote recognition is local. Unsupported browsers show the requested unsupported message; typing and the existing Deepgram selection remain available.

## Draft and playback

Interim and final results update one editable voice draft on the HUD. Speech activity resets a 2.5-second inactivity timer. Recognition `end` is never a send trigger. Blank drafts are ignored. Editing stops capture and automatic submission until **SEND** is pressed. **CANCEL** clears the draft and invalidates its old events and timers.

Before a request is sent, recognition is aborted and detached. It remains paused throughout the existing backend request, tool execution, response generation, Fish synthesis and all audio chunks. The complete response remains the single source for HUD text, history and Fish Audio. The controller resumes capture after the playback promise resolves from the actual audio `ended` lifecycle. It never resumes between audio chunks. Text-only replies resume after processing finishes.

**STOP VOICE** cancels the active response and playback, then resumes listening if MIC and HANDS-FREE remain enabled. **MIC ● OFF** disables capture and prevents further automatic restarts. **New conversation**, navigation, hidden pages and component teardown invalidate the old session. A hidden page requires an explicit resume when visible again.

Unexpected recognition termination permits one controlled restart, gated by microphone intent, hands-free intent, page visibility, editing and active work. A blocked start or repeated stop shows **Microphone paused.** and **RESUME MICROPHONE**. Recognition, AI and speech failures pause with their distinct requested error messages and do not automatically retry AI/TTS requests. Browser mode cannot interrupt speech by talking, because recognition is paused to prevent APEX hearing itself; use STOP instead. Deepgram's existing continuous mode remains a separate selectable option with its original behavior.

Normal text entry, SEND, Cancel, history and the cinematic response overlay remain usable. Starting a typed reply pauses an enabled browser microphone; use RESUME when ready. The existing audio timeout is a failure watchdog, not a successful speech-completion signal.

## State and ownership

`lib/browser-voice-session.mjs` owns OFF, IDLE, LISTENING, SENDING, WAITING, SPEAKING, PAUSED and ERROR. Only a real recognition `onstart` marks LISTENING. Only the existing audio player's successful playback lifecycle marks SPEAKING. Session generations, recognition-instance checks and an AbortController protect timers, model responses, queued TTS, playback completion and restarts from stale callbacks. The HUD mirrors this controller; it does not invent activity.

## Validation and files

182 automated tests passed. Twelve new controller tests cover privacy, microphone startup, interim/final drafts, inactivity, blank text, editing, cancel, recognition pause through playback, STOP, MIC OFF, disposal, controlled restart, hidden pages and distinct errors. Existing HTTP integration and production build/type checks passed.

Browser verification uses the isolated proxy's explicitly labelled mock recognizer and WAV tone. These are mocked speech-service tests, with no real microphone capture and no paid API calls. Actual browser recognition accuracy, browser permission behavior and Fish synthesis quality require a user-operated live session. Browser API availability varies by browser; lack of support is reported rather than simulated in production.

Added `lib/browser-voice-session.mjs`, `components/BrowserVoiceHud.tsx`, `components/browser-voice-hud.css`, `tests/browser-voice-session.test.mjs` and this guide. Updated `components/HudWorkPanel.tsx`, `components/HudPreview.tsx` and `tests/humanoid-ui-fixture.mjs`. Secrets and provider configuration were not changed.

APEX is served at http://127.0.0.1:3000/. Start with `npm.cmd run runtime` and `npm.cmd start` in separate terminals from the `apex` folder; build source changes with `npm.cmd run build` first.

Sources: [SpeechRecognition.processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally), [SpeechRecognition.available](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static).
