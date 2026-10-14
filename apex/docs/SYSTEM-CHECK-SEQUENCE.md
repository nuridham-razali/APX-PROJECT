# APEX system check sequence

Current update: see [18-node delivery](18-NODE-DELIVERY.md) for the electric-sweep replacement, 18 scoped diagnostic rows, warning badges for unverified checks, and the latest validation. The timing below describes the reconstruction presentation.

Click the shield **Run system check** button in the APEX dock, or type **APEX, system check** in APEX Chat. The same phrase is recognized in the voice transcript when Deepgram input is connected. The command routes to diagnostics directly rather than asking Qwen to invent a report.

Results replace the left overview card. The core stays anchored while its glow, connections, nodes and outer tracks rebuild in layers. The reasoning-web visibility preference is respected. Closing results restores the overview. This effect stays inside APEX; background tasks continue. Reduced-motion preferences compress the sequence and skip the expanding effect.

| Time | Presentation and sound |
| --- | --- |
| 0–1.5 s | Existing HUD; activation chime |
| 1.5–2.5 s | HUD dims; descending airy whoosh |
| 2.5–3.5 s | Cyan core and gold outline return; rising hum |
| 3.5–5 s | Gold glow grows; soft resonance; real checklist rows progressively appear |
| 5–6 s | Connections extend; digital ticks and electrical sweep |
| 6–7 s | Registered/planned node labels return; varied blips |
| 7–8 s | Angular outer circuitry returns; light sweep |
| 8–13 s | Broad upstream plasma curves flow in cyan; sustained scanning texture |
| 13–14.5 s | Expanding cyan halo and deep whoom with airy rush |
| 14.5–15.5 s | Halo settles; three rising chirps with echoes |
| 15.5 s onward | Gold completion badge, two-note chime, scanning fades; animated network holds |

Two audio layers are independent:

| Event | Sound |
| --- | --- |
| Command accepted | Short activation chime |
| Checks running | Quiet low-frequency scanning ambience |
| Check passes | Soft electronic tick |
| Check fails | Distinct two-note warning |
| Sequence completes | Two-note completion chime with short echo |
| Results announced | Fish Audio, APEX voice cae9af8ace0544c28879587a3496d6f0 |

Effects are synthesized locally with Web Audio; no paid API or downloaded soundtrack is used for them. The panel has an effects switch and volume slider. **Fish voice report** separately enables the cloud spoken summary. The completion chime and pending result sounds finish before the spoken report begins. Speaker/device audibility still depends on the user's audio output.

`POST /api/runtime/checks/stream` starts immediately and streams the existing 12 software checks. Presentation timing is independent: a fast completed report says “Checks collected · HUD reconstruction animation,” while rows reveal. A slow report prevents the completion badge until it actually finishes. Fish Audio says “System check complete, Idham,” then counts actual passed/failed/skipped rows and names failures. Model access checks the installed model list, not successful generation. These checks do not verify CPU/GPU temperatures, cloud voice connectivity, or external actions.

Closing the display aborts its event stream, pending speech request and playback, and closes the effects context. A server diagnostic already in progress may finish and save its report; background tasks continue. A second concurrent diagnostic receives an explicit conflict instead of overlapping probes.

Verification: 91 automated tests and production build passed. Tests cover truthful completion gating, bounded checklist reveal, running/final diagnostic events, split streaming frames, incomplete streams, duplicate-run conflicts, command routing and actual spoken summaries.
