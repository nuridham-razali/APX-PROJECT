# APEX and NOVA development plan

## Current milestone: conversation priority during background work

APEX is the main cyan/gold persona; NOVA is the calm violet/gold alternate. The user’s videos and screenshots determine the HUD design. The Stage 4 ZIP is not the visual authority. The shared particle core retains APEX state behavior, with real microphone/output levels driving voice animation. Next.js 15 and React 19 power the HUD, with Lucide, Three, React Three Fiber and Postprocessing. Source attribution is in CREDITS.md.

## Implemented

- Authenticated local runtime and same-origin HUD API proxy, persistent SQLite tasks, memory, approved corrections and conversation history.
- Local Qwen through Ollama, with no automatic paid-provider fallback. Task context is separate from foreground conversation.
- Bounded text task loops: plan, execute, review, one revision per step, cancellation, explicit retry and saved results. Missing sources or unavailable external actions stop for input.
- Natural English text-task requests return an immediate acknowledgment. A second task can be queued while work runs; status replies use runtime records without a model call.
- Two task workers, with local model admission limited to one background request by default. Conversation gets reserved capacity and priority over waiting background calls. Active model calls cannot be preempted; CPU and Ollama scheduling still affect response time.
- APEX uses Deepgram Flux English recognition and a separately selected Fish Audio voice. NOVA retains local Whisper recognition and Fish Audio voice 3a7bcde726774da88cef935fb2d64da3. Provider credentials stay private; APEX needs its two API keys before live voice can be tested.
- Opt-in continuous NOVA voice conversation, quiet turn detection, spoken task-stage announcements and Stop. The microphone pauses during recognition, answers and announcements; voice barge-in and wake words are not implemented.
- Approved correction examples and JSONL export for offline fine-tuning. Saving examples does not change model weights; LoRA has not been run.
- The large workspace view was removed from the user flow; /workspace redirects home. Tasks, chat, voice and settings remain in compact HUD panels.

Validation: 85 automated tests and production build pass. Live text-task acknowledgment, progress and completion were checked. Full microphone interaction remains a user hardware trial; NOVA Settings reports recognition, Fish configuration and conversation priority separately.

## Next milestones

1. Windows app/window/taskbar and browser tools through registered handlers and a local execution service. Start with bounded actions, exact receipts, cancellation and serialized control of shared desktop state.
2. Messaging connections for WhatsApp, Telegram and Outlook. Resolve recipients, read back recipient and exact final message (plus email subject/attachments), and require confirmation before sending. Edits invalidate prior approval.
3. CPU/RAM/GPU and available temperature telemetry, adjustable thresholds and alert cooldowns. Report unavailable sensors honestly.
4. Agent planning with registered real tools, source-aware progress, recovery and completion announcements. Tools must return receipts; model output alone is not evidence that an action happened.
5. Optional voice interruption and wake-word behavior. APEX now uses the selected Deepgram Flux service; live verification requires its private key and a Fish Audio key.
6. Reminders and loose-end detection against connected sources and user-defined rules. Suggest drafts; do not automatically send follow-ups.
7. Evaluate approved training examples and any offline adapter before explicitly importing and selecting a new local model. Preserve rollback.
8. Humanoid appearance later, reusing the assistant’s voice, memory, tasks and audio timing.

NOVA is warm, concise, calm, honest, careful and proactive. APEX is friendly and conversational. Tone changes never change confirmation requirements.

## Running

Run npm run build, then npm run launch. Open http://127.0.0.1:3000. Configuration and separate-service commands are in docs/LOCAL-BRAIN-VOICE.md and docs/APEX-CLOUD-VOICE.md. Credentials remain server-side in .env.local. Desktop control, messaging and humanoid appearance are not connected yet.
