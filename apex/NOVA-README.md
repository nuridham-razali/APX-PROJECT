# NOVA HUD

NOVA is the alternate persona on the home page. Select NOVA in the APEX persona control; switch back with the upper-right APEX button. The uploaded video supplies the HUD composition. The latest nebula image supplies the scene appearance: magenta/violet and cyan accents over a dense star field. The later smoke direction uses translucent wisps flowing across the galaxy. No reference image or video is used as the rendered background.

## Run on Windows

Requires Node.js 22.13 or newer.

```powershell
cd 'C:\Users\Win11\Documents\ChatGPT\New project\apex'
npm.cmd ci
npm.cmd run build
npm.cmd run launch
```

Open http://127.0.0.1:3000/. Keep the launcher running. For development, run `npm.cmd run dev` and `npm.cmd run runtime` in separate terminals. If a previous server is running, stop it before launching another.

Copy `.env.example` to `.env.local` and configure the existing Gemini key only when you want model replies. Secrets remain server-side. No key is required for the scene, audio meters, clock, local historical dataset, or panels. Weather uses a town you select or geolocation you explicitly allow; unavailable data is shown honestly.

## Implemented

- NOVA combines an animated purple vortex with the original APEX particle core inside its black center and the APEX SVG ring state effects. The original APEX particle core remains unchanged. Its cloud scene adds 4,500 background stars, layered procedural smoke, and restrained bloom.
- Shared idle/listening/processing/thinking/speaking state. Processing and thinking both map to the existing APEX thinking animation. Clouds gather while listening, swirl faster with turbulence while processing/thinking, and pulse with output amplitude while speaking. Active background jobs select processing while foreground chat and audio are idle. Stop closes audio resources and resets amplitudes. Microphone audio is not uploaded by the meter.
- Clock and greeting follow device time. Historical events use the existing date-matched verified dataset. Weather uses the existing server routes.
- Hidden settings, chat, saved tasks, and core controls. Preview states are explicitly labeled. Text chat uses the existing runtime and provider with NOVA's calm, concise personality; tasks and memory use the shared local runtime store. Foreground requests can be stopped without stopping background tasks.
- Reduced motion, hidden-page render pause, capped DPR, low-power rendering, effects-off control, static WebGL fallback, keyboard focus containment and Escape dismissal.

## Integration limits

Deepgram Flux and Fish Audio are not connected yet. The local microphone meter does not transcribe or understand speech. Local-file playback demonstrates output amplitude; it is not an AI voice response. Existing browser dictation and speech playback remain accessible at `/workspace`.

Windows control, external messaging, Outlook and other service actions still require their connectors. No external message is sent by this HUD. The assistant's tone instructions preserve confirmation requirements, but they do not replace a future enforced sending gate. There is no authentication account in this local project, so no fake logout control is added.

## Components and checks

`components/nova/visual-config.ts` centralizes palette and rendering settings. `NovaScene.tsx` contains the GPU scene, `NovaHud.tsx` coordinates runtime and panels, `useNovaAudio.ts` handles audio resources, and `NovaWaveform.tsx` renders amplitude without per-frame React state updates.

```powershell
npm.cmd test
npm.cmd run verify:http
npm.cmd run build
```

Tests use fixtures and isolated temporary runtime data; they do not make paid AI calls. Dependency notices remain in `docs/licenses` and `CREDITS.md`.


The latest two references define the current scene: the first supplies the swirling pink-violet vortex and black center; the second supplies the centered cyan-magenta nebula behind it. During speaking, blue smoke spreads into drifting banks across the galaxy while the magenta nebula stays around the core. The blue smoke gathers back afterward. The vortex expands during listening, spins faster during processing/thinking, and responds to speaking amplitude. No reference image is used as a static rendered background.


The current MIRA reference replaces the thick vortex with thin lavender and warm-gold glowing orbit lines around the shared APEX particle core. Only subtle purple mist remains behind the core. Speaking adds no blue clouds: the outer lines expand and contract in a double-beat rhythm, swing on tilted orbits, and carry small glowing points. Playback amplitude adds extra expansion and brightness; state motion is visually separate from audio amplitude. Orbit radius follows listening/thinking states and glow follows actual playback amplitude (or an explicitly labeled preview). Rotation remains anticlockwise. The larger overview card is retained.
