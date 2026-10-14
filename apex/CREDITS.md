# Credits

## Local brain and voice

The installed Qwen 2.5 7B model runs through local Ollama. Whisper recognition uses
SYSTRAN faster-whisper 1.2.1 and the multilingual base model. Local speech uses the
separate Piper 1.8.0 Python service (GPL) and Lessac medium voice; the downloaded
voice MODEL_CARD is retained under the private voice models directory. PyAV is
pinned below 17 for Whisper decoder compatibility. See docs/LOCAL-BRAIN-VOICE.md
for operation and training/export boundaries.

## APEX-UI source and HUD adaptation

This personal assistant HUD builds on [RubenM1990/APEX-UI](https://github.com/RubenM1990/APEX-UI)
by Ruben Mouradian (Reznikov Engineering), supplied through the user's Stage 4 archive.
The original MIT copyright and license are preserved in `LICENSE`.

The main preview uses components downloaded directly from GitHub into
`components/upstream/`: `ApexOrb.jsx`, `ApexCore3D.jsx`, and `apex-orb.css`.
The SVG ring and listening/thinking/speaking behavior come from upstream. The
original 28-bar `Waveform` is reused with cyan/gold alternating colors and speaking-only
activation. Local adaptations add animation pause support. React Three Fiber and React Three
Postprocessing render the particle scene with bloom. Local wrappers provide the
APEX/NOVA tint, responsive containment, HUD layout, and personality controls.
NOVA now uses the unmodified APEX particle motion and SVG frame reactions with
an optional orange particle material color. Its former synthetic center glow is
removed so it does not obscure the shared core. NOVA's outer speaking ribbons
move more slowly and smooth their expansion separately from audio brightness.
Canvas 2D renders decorative space ribbons and NOVA trails; it does not implement
the particle core. Visual layout follows the user's uploaded video, rather than
the Stage 4 ZIP's dashboard.

APEX's plasma backdrop now uses the upstream `ShaderBackground.jsx` shader's
warped plasma geometry instead of the former Canvas 2D sine ribbons. Local
changes alternate cyan and gold strands, add traveling white highlights along
the shader curves, connect brightness to output audio levels, and honor pause
and reduced motion. The upstream MIT attribution is retained in the source.

The APEX HUD also reuses upstream `ReasoningWeb.jsx` for its orbital SVG network,
spokes and task-triggered particle traces. The local wrapper supplies registered
roles, clearly marked planned nodes, runtime task events, node details and a
keyboard-accessible node list. Local changes disable simulated ambient activity,
respect reduced motion and cancel pending trace timers during cleanup.

Runtime license metadata: Next.js, React, React DOM, Three.js, React Three Fiber,
and React Three Postprocessing are MIT. Lucide React is ISC, with MIT Feather
portions identified in its bundled `LICENSE`. Dependency license files are retained
in installed packages. The upstream code license does not grant upstream branding rights.

APEX-UI builds on two excellent **MIT-licensed** community components from
[21st.dev](https://21st.dev/community/components):

- **Animated shader background** — `components/ShaderBackground.jsx`
  (the WebGL "plasma waves" backdrop behind the orb).
- **Overview lamp panel** — the glowing filament HUD in `components/ApexOverviewPanel.tsx`.

Both are used under the MIT license, which permits reuse (including commercial)
provided attribution is kept — hence this file.

> If you fork APEX-UI, please keep this attribution. And if you know the original
> authors' 21st.dev handles, add the exact component links below so credit is precise:
>
> - Shader background: `<21st.dev component URL / author>`
> - Overview lamp: `<21st.dev component URL / author>`

Everything else (the SVG orb, reasoning-web graph, status bar, and app wiring) is
original to this project.

## Weather and location data

Weather data: [Open-Meteo](https://open-meteo.com/), with attribution displayed in the HUD.
Town search: Open-Meteo Geocoding API, based on [GeoNames](https://www.geonames.org/).
Source documentation: [weather API](https://open-meteo.com/en/docs) and
[geocoding API](https://open-meteo.com/en/docs/geocoding-api).

Historical event excerpts: [Wikipedia](https://en.wikipedia.org/), via the
[Wikifeeds On this day API](https://www.mediawiki.org/wiki/Wikifeeds).
Excerpts link to their source article and may be shortened for the HUD. Wikipedia text is
available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); see each article
history for contributors. Original project notices remain included.
