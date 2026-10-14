# APEX speech interaction

APEX now has NOVA's compact top-centre `LIVE · TAP TO STOP` session control, in both the core HUD and humanoid view. It appears from actual conversation/capture/playback events; selecting an animation preview alone does not activate it. During speech it uses a gold accent. It remains available even when the right-side microphone controls are hidden.

Tapping it stops playback, microphone capture and the current conversational reply. It does not cancel saved background tasks. Explicitly enable the microphone again to restart listening. The compact wake indicator sits below it without overlap.

Actual response text appears in the existing lower-left HUD overlay, stays throughout speech, holds for three seconds after playback completes or is stopped, and fades for 1.2 seconds. A newer reply cancels the previous fade. History stays saved. Text-only and failed-audio replies also fade without claiming speech occurred.

Changed files: `components/ApexSessionControl.tsx`, `components/apex-session-control.css`, `components/HudPreview.tsx`, `components/HudWorkPanel.tsx`. Existing response-lifecycle code and its verified fade timings were preserved. Provider/model, Fish Audio settings, NOVA and core designs were not changed.

Verification: production build/type checking and 199 automated tests passed. Browser checks used fake recognition and real playback of a synthetic WAV: the new button stopped active speech, capture stayed OFF, and the text faded. A normal completion resumed listening and cleared the temporary response. Both HUD and humanoid views were checked. No live microphone, Fish Audio or Deepgram requests were made.

`previews/apex-live-stop-hud.png` and `previews/apex-live-stop-speaking.png` are clearly labelled mock verification screenshots. The uploaded video was inspected locally at representative conversational frames; no exact frame-by-frame timing match is claimed.

The updated application is running at http://127.0.0.1:3000/. Reload the existing page to load the control.
