import { spawn } from 'node:child_process';
import net from 'node:net';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
try { process.loadEnvFile('.env.local'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const port = Number(process.env.APEX_RUNTIME_PORT || 8081);
async function checkPort(value) {
  await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', () => reject(new Error(`Port ${value} is already in use. Close the previous APEX window or choose a different APEX_RUNTIME_PORT for the runtime.`))); probe.listen(value, '127.0.0.1', () => probe.close(resolve)); });
}
try { await checkPort(3000); await checkPort(port); } catch (e) { console.error(e.message); process.exit(1); }
const children = [spawn(process.execPath, ['runtime/server.mjs'], { stdio: 'inherit' }), spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1'], { stdio: 'inherit' })];
const voicePython=resolve('.apex-data/voice-env/Scripts/python.exe');
if(existsSync(voicePython)&&existsSync('.apex-data/voice-models/en_US-lessac-medium.onnx'))children.push(spawn(voicePython,['-u','runtime/voice_service.py'],{stdio:'inherit'}));
let closing = false;
const stop = (code = 0) => { if (closing) return; closing = true; for (const child of children) child.kill('SIGTERM'); setTimeout(() => process.exit(code), 500); };
for (const child of children) { child.on('error', e => { console.error(e.message); stop(1); }); child.on('exit', code => { if (!closing) { console.error('An APEX process stopped. Review the error above.'); stop(code || 1); } }); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
for (let attempt = 0; attempt < 100 && !closing; attempt++) {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/runtime/state', { signal: AbortSignal.timeout(1000) });
    if (response.ok) { console.log('\nAPEX ready: http://127.0.0.1:3000\nKeep this window open. Press Ctrl+C to stop.'); if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', 'http://127.0.0.1:3000'], { stdio: 'ignore' }); break; }
  } catch {}
  await new Promise(r => setTimeout(r, 200));
  if (attempt === 99) { console.error('APEX did not become ready. Check the error messages.'); stop(1); }
}
