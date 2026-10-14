# Local Qwen brain, voice, and training

APEX voice update (7 October 2026): the main APEX HUD now uses Deepgram `flux-general-en` and a separately selected Fish Audio voice. Setup and validation are in [APEX-CLOUD-VOICE.md](APEX-CLOUD-VOICE.md). NOVA remains on local Whisper plus Fish. Earlier Piper/browser descriptions below are historical for APEX.

APEX/NOVA use the installed `qwen2.5:7b` through loopback Ollama. `runtime/server.mjs` defaults to `APEX_PROVIDER=ollama`; it never falls back to a paid provider. `.env.local` may explicitly override `OLLAMA_MODEL` with another installed local model. Chat, memory, and task planning/review use this provider. Installed does not mean reachable: service/model failures surface in the HUD.

This PC currently runs Qwen 7B on CPU (Ollama reports no GPU allocation). Task planning can be slow. The already installed `qwen3:1.7b` is an optional faster model; set `OLLAMA_MODEL=qwen3:1.7b` and restart the runtime to compare speed and answer quality. Qwen 3 thinking output is disabled for the conversational path.

Recognition uses multilingual Whisper base on CPU int8. APEX uses local Piper Lessac for English output. NOVA now uses Fish Audio voice `3a7bcde726774da88cef935fb2d64da3`; NOVA reply text leaves this device for speech synthesis. The selected voice is configured, but its access and sound are unverified until a successful live request. Models are downloaded once into `.apex-data/voice-models`; Whisper and Piper inference is local. Microphone audio requests stay on loopback and are held in memory, not saved as recordings. Recognized text and replies become ordinary local conversation records. Click **Speak to NOVA/APEX**, say a short request, then **Finish voice request**. The microphone stops before recognition and playback. Push-to-talk remains available. NOVA now also offers an opt-in continuous voice conversation; this is not a wake-word listener. English replies can be read aloud; other response languages remain text in the current integration.

Start with `npm run launch` after `npm run build`; it starts the runtime, HUD, and installed voice service. For separate terminals:

```
npm run runtime
.apex-data\voice-env\Scripts\python.exe -u runtime\voice_service.py
npm run start -- --port 3000
```

Initial setup on another Windows machine:

```
python -m venv .apex-data/voice-env
.apex-data\voice-env\Scripts\python.exe -m pip install -r runtime/voice-requirements.txt
.apex-data\voice-env\Scripts\python.exe runtime/setup_voice.py
```

The audio analyser drives NOVA's brightness, expansion and swing from the spoken waveform's envelope and spectral brightness. It does not infer emotion. Small luminous packets travel along the complete softly glowing orbit lines. The animation preview is synthetic and labeled.

## NOVA Fish Audio configuration

Add `FISH_API_KEY=your_private_key` to `.env.local` without replacing existing brain settings, then restart `npm run runtime`. Never use a NEXT_PUBLIC key or paste it into chat. NOVA settings show API key configuration separately from local recognition readiness. This is configuration status, not a successful connection test. Missing credentials do not disable local microphone input or text replies. APEX still uses Piper.

The adapter sends the explicit `model: s2.1-pro-free` header on every request. There is no automatic paid-model or Piper fallback for NOVA. Free-tier limits or account/voice access errors appear in chat; the written reply remains available. Fish Audio requires an API key and internet access. Audio playback feeds the existing analyser, so core and line brightness follow the actual generated voice. No API credentials are sent to the browser.

Reference: [Fish Audio TTS API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech).

## Continuous NOVA voice conversation

Choose **Start voice conversation** in NOVA Chat or Core. English, local Whisper, Ollama, and configured Fish output must be available. The session starts only from that button and is never restored automatically after refresh. Sustained input followed by about 1.1 seconds of silence finishes the request. Silence alone and isolated clicks do not submit requests. Capture cycles are bounded to 30 seconds; empty idle cycles rotate locally without recognition or model calls.

The microphone stops before local Whisper transcription, Qwen inference, and Fish synthesis/playback. The loop waits until the spoken reply finishes, leaves a 600 ms quiet gap, then listens again. It does not listen during NOVA output; voice barge-in is not part of this phase. Use the persistent Stop control during an answer, or say **stop listening** while capture is active. That command is handled locally before the model. Typing switches out of the voice session. Hiding the HUD also ends the session because browser audio sampling is unreliable in hidden tabs; background tasks continue.

Permission, recognition, provider, or playback errors pause the loop and show the saved text/error. Stop invalidates outstanding work so delayed replies cannot reopen the microphone. Background task workers remain independent; starting the voice loop does not give the model new desktop or messaging tools. Existing confirmation rules remain unchanged. Incoming microphone audio stays local; NOVA reply text goes to Fish for output. CPU Qwen 7B may take time to answer.

Validation: 65 automated tests cover silence detection, duplicate endpoints, stale callbacks, full playback and quiet-gap ordering, cancellation during recognition/reply, and local spoken Stop. Production build passed. Hardware microphone capture and a complete real spoken conversation still require the user's trial; component status and synthesis playback can be verified separately.

## Conversation while tasks run

Local inference now reserves application capacity for conversation. By default, two model requests may be submitted, with at most one background request. Both task workers remain available, but one can wait between its model calls. Foreground calls take priority over waiting background calls, and queued cancellation removes the request before model submission. Active cancellation discards late output and releases its slot only when the provider settles. Runtime shutdown cancels both waiting and active requests. Status exposes request counts only, never queued prompts or model reasoning.

Optional settings: `APEX_INFERENCE_CONCURRENCY=2` (2–3 total requests) and `APEX_BACKGROUND_INFERENCE_LIMIT=1` (at least one and fewer than total). Defaults apply without editing private credentials. The scheduler does not preempt an active Ollama call, guarantee parallel CPU computation, or switch to another model/provider. Ollama's own scheduling and available memory still affect latency. NOVA Settings reports whether conversation priority is active.

Natural English requests starting with **draft, write, summarize, analyze, review, compare, prepare, revise, or proofread** now queue a closed-loop text task and immediately return “On it.” Polite prefixes such as “Nova, can you please…” work. For other goals, say **Start a background task to …**. The planner asks for missing material or unavailable capabilities; it does not pretend it can read arbitrary project folders or send messages. Task source and output remain separate from ordinary conversation. A second request queues another task while the first runs.

Ask **What are you working on?**, **How is it going?**, or **How long will it take?** for a direct answer from saved task state, without waiting for Qwen. No percentage or finish time is invented. General conversational replies still use the shared local Qwen model and can take longer when the PC is busy.

With voice conversation enabled, NOVA announces running, checking, and terminal task stages. Updates wait for a fresh microphone capture with 2.5 seconds of quiet and no detected voice, or until the current user turn and spoken answer finish. Recognition and replies are never interrupted by an update. Pending updates for the same task are replaced by its newest state. Playback finishes before a 600 ms gap and microphone restart. Stop clears pending announcements and cancels speech, while background work continues. These are task-stage updates, not constant filler speech. Text updates remain visible when voice is off.

Validation: 70 automated tests pass, including immediate natural-task acknowledgment during held background inference, second-task queuing, truthful status, quiet-boundary announcements, obsolete-update replacement, and Stop during announcement playback. A full microphone conversation remains a user hardware trial.

The next phase adds six scheduler tests (76 total), covering reserved capacity, foreground ordering, queued and active cancellation, provider failures, shutdown, and engine integration with two occupied task workers.

Live HUD verification: a synthetic greeting draft was acknowledged immediately; a follow-up progress question returned while local Qwen was planning; the task then completed its execution and model review and reported its saved result. Production build passed. At verification, `.env.local` was missing. An empty private template was restored; the Fish key must be re-entered privately and the runtime restarted before live voice playback can be checked again. Local Whisper remained ready.

## Improve the brain with approved examples

Use `/remember ...` for explicit persistent facts. In NOVA chat, **Teach NOVA: correct the last reply** lets you approve a corrected prompt/answer pair. Only clicking **Save approved training example** creates a training record. The latest four approved NOVA examples are included in future NOVA prompts. This is immediate personalization, not weight training.

In settings, **Export approved training examples** downloads chat-format JSONL for offline supervised fine-tuning. Unapproved conversations are not exported. Keep secrets out of training examples. The export contains only the saved prompt, corrected answer, and base persona; it does not include unrelated memory or conversation turns.

`training/train_lora.py` is an offline LoRA starter for the unquantized Qwen Hugging Face base model. It requires a separate CUDA training environment with torch, transformers, datasets, peft, accelerate, and enough GPU memory. It trains only assistant-answer tokens, holds out 10% of examples, and saves a separate adapter. Collect a varied, reviewed dataset first; the 20-example minimum is a guard against empty experiments, not a promise of useful results. The script has not been run on this PC and no model weights have been trained yet.

Evaluate the trained adapter against held-out tasks and permission/confirmation scenarios, merge with its exact base model, convert/quantize to GGUF using llama.cpp, and import it as a new model with `ollama create`. Then explicitly switch `OLLAMA_MODEL` and restart. Preserve the original model as a rollback. Runtime never automatically trains or replaces weights.

References: [Ollama chat](https://docs.ollama.com/api/chat), [model import](https://docs.ollama.com/import), [Qwen](https://github.com/QwenLM/Qwen2.5), [PEFT](https://github.com/huggingface/peft), [Whisper](https://github.com/SYSTRAN/faster-whisper), [Piper](https://github.com/OHF-Voice/piper1-gpl). Piper code is GPL; voice model terms are retained in the downloaded MODEL_CARD. These dependencies run as a separate local Python service; the HUD dependencies remain unchanged.

## Verified on 6 October 2026

- Production build and 54 automated tests passed.
- HTTP proxy checks passed, including authentication, cross-origin rejection, memory and SSE.
- Piper generated a synthetic spoken request; local Whisper transcribed it as “Hello Nova, please say ready.”
- A live Qwen chat returned a usable NOVA reply, and browser chat completed without a speech error.
- A live in-memory Qwen task loop completed planning, text execution, and result review. Ollama schema constraints restrict planner outputs to registered text handlers; runtime validation still checks every response.
- Local connection controls and speaking pulse animation were inspected in the HUD.
- Microphone capture was not activated during automated verification. The user grants permission when choosing Speak. LoRA training has not been executed; model weights remain unchanged.
