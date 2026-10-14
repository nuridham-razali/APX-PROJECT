import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {sameLocalOrigin} from './local-origin.mjs';
const allowed = new Set(['conversation','task-notifications','chat/stream','loops/create','loops/control','loops/update','loops/approve','loops/history','loops/notifications','personality','nodes/run','nodes/approve','state', 'events', 'checks', 'checks/stream', 'chat', 'stop-chat', 'tasks', 'workflows', 'cancel', 'retry', 'acknowledge', 'memory', 'edit-memory', 'delete-memory', 'voice/status', 'voice/transcribe', 'voice/speak', 'voice/flux/start', 'voice/flux/audio', 'voice/flux/stop', 'training', 'training/export']);
export async function proxyRuntime(request: Request, path: string) {
  if (!allowed.has(path)&&path!=='hermes/status') return Response.json({ error: 'Unknown runtime operation.' }, { status: 404 });
  if (process.env.APEX_DEPLOYMENT_MODE === 'hud-only') return Response.json({ error: 'Local backend not connected. This deployment displays the APEX HUD; chat, voice and task execution remain on your PC.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return Response.json({ error: 'This build supports local access only.' }, { status: 403 });
  const origin = request.headers.get('origin');
  if (!sameLocalOrigin(origin,url.origin)) return Response.json({ error: 'Cross-site requests are blocked.' }, { status: 403 });
  const readOnly = ['hermes/status','state', 'events', 'voice/status', 'training/export'].includes(path);
  if ((readOnly && request.method !== 'GET') || (!readOnly && request.method !== 'POST')) return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  try {
    const token = (await readFile(join(resolve(process.env.APEX_DATA_DIR || '.apex-data'), 'runtime-token'), 'utf8')).trim();
    const port = Number(process.env.APEX_RUNTIME_PORT || 8081);
    const body = readOnly ? undefined : await request.text();
    if (body && body.length > (path.startsWith('voice/')?4000000:250000)) return Response.json({ error: 'Request is too large.' }, { status: 413 });
    const response = await fetch(`http://127.0.0.1:${port}/${path}`, { method: request.method, headers: { 'Content-Type': 'application/json', 'x-apex-token': token }, body, cache: 'no-store', signal: path === 'events' ? request.signal : AbortSignal.any([request.signal, AbortSignal.timeout(190000)]) });
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': path==='chat/stream'?'application/x-ndjson':['events','checks/stream'].includes(path) ? 'text/event-stream' : 'application/json', 'Cache-Control': 'no-store, no-transform' } });
  } catch {
    return Response.json({ error: 'APEX runtime is unavailable. Run npm run runtime in a second terminal, or use Start.bat.' }, { status: 503 });
  }
}
