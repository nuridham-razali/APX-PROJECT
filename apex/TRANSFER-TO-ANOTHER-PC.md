# Move APEX to another Windows computer

This portable source package contains APEX's HUD, humanoid, agent network, chat and backend tools. It includes the exact dependency lockfile. Dependencies and build outputs are recreated on the destination computer.

1. Install Node.js 22.13 or newer, and Chrome or Microsoft Edge.
2. Download the repository ZIP or the supplied portable ZIP. Extract it into a folder you own.
3. Open the `apex` folder and double-click `Start.bat`.
4. When `.env.local` is created, privately enter your Gemini, Deepgram and Fish Audio API keys. The chosen model and public voice IDs are in `.env.example`. Never commit `.env.local`.
5. Save the file, return to the startup window, and continue. Startup installs dependencies, runs tests, builds the HUD and starts the backend.
6. Open `http://127.0.0.1:3000/`. Allow microphone access on this new computer. Account integrations require their own valid OAuth credentials and scopes.

Keep the startup window open while using APEX. Allow Windows/browser permission prompts when applicable. Brightness and other desktop controls depend on the new computer's hardware. No Ollama model or local LLM download is required for the selected Gemini route.

## What is intentionally excluded

API keys and OAuth tokens (`.env.local`, `.gemini`), private `.apex-data` records, chat history, saved memories, browser cookies/profiles, local runtime tokens, optional local voice models/Python environments, `node_modules`, `.next`, caches and Vercel account metadata are not included in GitHub or the portable ZIP.

APEX starts with new local records on the other computer. To migrate existing conversations/memories/personality too, stop APEX first and transfer the local `.apex-data/apex.sqlite` database privately, together with its SQLite WAL/SHM files if present. Do not upload these files to GitHub. Back up the destination database before replacing it; transfer between stopped instances to avoid inconsistent snapshots. Transfer keys privately or re-enter them. Do not copy browser profiles or runtime tokens; APEX creates new ones.

The source package preserves functionality, but does not automatically transfer browser microphone permission, your accounts, Windows device configuration, or browser-local HUD preferences. Optional NOVA local Whisper recognition needs the existing voice-service setup described in `NOVA-README.md`; APEX uses Deepgram Flux and Fish Audio.

For terminal startup: `npm ci`, `npm test`, `npm run build`, then `npm run launch`, from the `apex` folder.
