# Vercel HUD deployment

Production URL: https://apex-beta-three.vercel.app/ (Vercel sign-in protection retained).

Verification on 11 October 2026: production deployment READY, authenticated live page HTTP 200 with the hosted-backend notice, runtime state HTTP 503 with the accurate disconnected message, 229 automated tests passed, and both cloud and local production builds passed. No model or voice API tests were called.

This deployment hosts the existing Next.js HUD, APEX/NOVA visuals, navigation, weather and historical-event routes. The local Ollama/Hermes runtime, conversation database, task workers and Fish/Deepgram services remain on the owner's PC.

`vercel.json` sets the server-only `APEX_DEPLOYMENT_MODE=hud-only`. The page renders dynamically so this runtime setting controls the visible notice and disables the APEX voice panel. Runtime routes return an honest 503 and never attempt to read a runtime token from the cloud filesystem. Local development has no deployment-mode setting, so its existing runtime and voice behavior are preserved.

`.vercelignore` excludes environment files, `.apex-data`, training records, databases, build files and dependencies from upload. Do not add local provider keys to Vercel for this HUD-only deployment.

Deploy from the `apex` folder:

```powershell
npx vercel login
npx vercel deploy --prod
```

The account owner must approve Vercel's sign-in flow. A later functional hosted deployment requires authenticated HTTPS connectivity to a persistent backend; Vercel cannot reach the PC's loopback addresses.
