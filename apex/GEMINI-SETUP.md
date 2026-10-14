APEX uses `gemini-3.5-flash-lite`, selected from this account's available-model list after the earlier 2.5 generation endpoint returned HTTP 404. Its private key remains in `.env.local`. Both APEX and NOVA use the configured brain. Fish Audio voices, Deepgram microphone settings, conversation history, personality and the 18-node registry are unchanged.

```dotenv
APEX_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=your_private_key
APEX_ORCHESTRATOR=direct
```

Keep keys private; never place them in a `NEXT_PUBLIC` variable. Changing these settings requires restarting the APEX runtime. Start the application with `Start.bat`, or use `npm run launch` after building it.

The local-only Hermes model gateway rejects paid providers. Hermes is disabled in this configuration rather than silently retaining Ollama or pretending that Hermes research works. Other registered local tools remain available. Researcher can work on supplied sources; live search needs its separate configured search adapter. Loops still require their scoped Gemini quota approval before paid background inference.

The Gemini adapter now requests JSON for acknowledgments and planning/review schemas, preserves the configured model and system instructions, and rejects incomplete replies. Provider errors never fall back to Ollama. Mock tests verify these requests without a Google generation call.

`node scripts/check-gemini-config.mjs` checks only model metadata and prints no keys. A successful metadata check confirms the model endpoint and supported method; it does not prove generation quota or response quality. No live Gemini generation or Fish Audio test was performed during this change.
