# APEX: Deepgram Flux English and Fish Audio

The APEX HUD now uses Deepgram `flux-general-en` for streaming English speech recognition and Fish Audio `s2.1-pro-free` with the voice configured in `APEX_FISH_VOICE_ID` for output. NOVA retains local Whisper and Fish Audio. The assistant brain remains local Qwen/Ollama.

Add your private credentials in `.env.local`:

```dotenv
DEEPGRAM_API_KEY=
FISH_API_KEY=
APEX_FISH_VOICE_ID=cae9af8ace0544c28879587a3496d6f0
```

Fill the values privately, then restart `npm run runtime`. Never put these keys in chat or a NEXT_PUBLIC variable. The fields have been prepared without replacing existing configuration. The permanent keys remain in the authenticated Node runtime. No key is returned by voice status or shipped in the browser bundle.

Open APEX Chat, choose **Check voice connection**, and then **Test APEX voice**. This test uses a short fixed greeting and does not need speech recognition or a model response. **Speak to APEX** starts live recognition. APEX answers on Flux's final `EndOfTurn`, then listens again after spoken playback finishes. The microphone stops before conversation inference or output, preventing assistant audio from being sent back to recognition. Typing exits the listening session; **Stop voice session** closes capture and playback and suppresses future speech from the current pending reply. Non-English voice recognition is not enabled for this English model.

Browser AudioWorklet capture emits 160 ms chunks of signed little-endian mono PCM at 16 kHz. Local authenticated HTTP carries the chunks to a persistent server WebSocket at `wss://api.deepgram.com/v2/listen`. Interim text appears in the HUD but does not submit work. A final turn submits exactly once. Sessions expire after five minutes or sixty seconds without incoming audio; stop/error/unmount closes microphone tracks, audio context and the upstream session. A bounded queue stops capture if the connection cannot keep up, rather than accumulating audio indefinitely.

Microphone audio is transmitted to Deepgram. Spoken reply text is transmitted to Fish Audio. These are cloud services and use their account credits. Missing keys or service errors remain visible; APEX does not silently switch to browser dictation, Whisper, Piper or another voice. The local services remain available for NOVA and older explicit local endpoints.

Verification: production build and 85 automated tests passed. Tests cover separate APEX/NOVA Fish voices, credentials, sanitized errors, Flux final-event handling, stream bounds, expiration, PCM format and cancellation. A live Fish request successfully returned 109,504 bytes of MP3 for APEX voice cae9af8ace0544c28879587a3496d6f0. The HUD voice test completed without a displayed error; audibility on the user's speakers requires their confirmation. Deepgram key formatting still needs correction before live recognition can be verified.

Official references: [Flux streaming API](https://developers.deepgram.com/reference/speech-to-text/listen-flux), [Deepgram WebSocket authentication](https://developers.deepgram.com/docs/using-the-sec-websocket-protocol), [Fish Audio create speech](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech).
