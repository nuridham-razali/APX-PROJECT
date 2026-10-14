# APX-PROJECT

APEX personal assistant source and a portable Windows package, backed up 14 October 2026.

- [Download the portable ZIP](downloads/APEX-portable-2026-10-14.zip)
- [Setup on another computer](apex/TRANSFER-TO-ANOTHER-PC.md)
- [Backend tools, permissions and verification](apex/docs/TOOLS-IMPLEMENTED.md)
- [Package manifest](downloads/MANIFEST.json) and [ZIP checksum](downloads/SHA256SUMS.txt)

Install Node.js 22.13 or newer and Chrome or Edge. Extract the ZIP, open `apex`, and run `Start.bat`. Enter your keys privately in `.env.local`; open `http://127.0.0.1:3000/` after startup.

The source preserves APEX/NOVA HUDs, humanoid form, the 18-node map, chat, personality, configured Gemini model and public Fish Audio voice IDs. Dependencies and build outputs are recreated on the new computer. Gemini, Fish Audio, Deepgram and connected services require your own valid credentials.

Credentials, private conversation/memory databases, microphone/browser permissions and profiles, optional local voice environments/models, runtime tokens, Vercel metadata and generated dependencies/build files are intentionally excluded. See the transfer guide for privately migrating local records. Never upload `.env.local` or `.apex-data`.

This snapshot passed 273 Node tests and a Next.js production build during implementation. Gemini integration tests were mocked, not billable live tests; selected public web/browser and read-only Windows checks were live. Missing account integrations are reported as Not configured.
