import http from 'node:http';
import { resolve, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Store } from './store.mjs';
import { runDiagnostics } from './diagnostics.mjs';
import { Engine, InputError, text } from './engine.mjs';
import {hermesModelRequest} from './hermes-model-gateway.mjs';
import {voiceRequest} from './local-voice.mjs';
import {fishSpeak,fishStatus} from './fish-voice.mjs';
import {apexVoiceStatus,FluxSessions} from './apex-voice.mjs';
import {saveCorrection,exportCorrections} from './training.mjs';
try { process.loadEnvFile('.env.local'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
// This installation uses Gemini. Credentials always remain on the backend.
process.env.APEX_PROVIDER ||= 'gemini';
process.env.APEX_FREE_WEB_SEARCH ||= 'true';
const dir = resolve(process.env.APEX_DATA_DIR || '.apex-data');
mkdirSync(dir, { recursive: true });
const tokenPath = join(dir, 'runtime-token');
try { writeFileSync(tokenPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
const token = readFileSync(tokenPath, 'utf8').trim();
const hermesModelTokenPath=join(dir,'hermes-model-token');
try{writeFileSync(hermesModelTokenPath,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
const hermesModelToken=readFileSync(hermesModelTokenPath,'utf8').trim();
const store = new Store(join(dir, 'apex.sqlite'));
const engine = new Engine(store);
const flux=new FluxSessions();
engine.lastWorkerHeartbeat = Date.now();
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const authorized = value => typeof value === 'string' && Buffer.byteLength(value) === Buffer.byteLength(token) && timingSafeEqual(Buffer.from(value), Buffer.from(token));
async function json(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > (req.url?.startsWith('/voice/')?4000000:250000)) throw new InputError('Request is too large.', 413); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; } catch { throw new InputError('Invalid JSON request.'); }
}
let stopping = false;
const server = http.createServer(async (req, res) => {
  if(req.url==='/hermes/model/v1/chat/completions'){
    const supplied=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(Buffer.byteLength(supplied)!==Buffer.byteLength(hermesModelToken)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(hermesModelToken)))return send(res,401,{error:'Model gateway access denied.'});
    if(req.method!=='POST')return send(res,405,{error:'Method not allowed.'});
    const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    try{const body=await json(req);const result=await hermesModelRequest(body,{store,signal:controller.signal,onChunk:body.stream?chunk=>{if(!res.headersSent)res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.write(`data: ${JSON.stringify(chunk)}\n\n`);}:undefined});
      if(body.stream){res.write('data: [DONE]\n\n');res.end();}else send(res,200,result);
    }catch{if(res.headersSent){res.write('data: {"error":{"message":"APEX local model gateway failed or blocked this request."}}\n\n');res.end();}else send(res,503,{error:{message:'APEX local model gateway failed or blocked this request.'}});}return;
  }
  if (!authorized(req.headers['x-apex-token'])) return send(res, 401, { error: 'Runtime access denied.' });
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    if (req.method === 'GET' && path === '/state') return send(res, 200, engine.status());
    if(req.method==='GET'&&path==='/hermes/status'){try{await engine.hermes.probe();}catch{}return send(res,200,engine.hermes.status());}
    if (req.method === 'GET' && path === '/voice/status') {
      const local = await voiceRequest('status',null,token).catch(()=>({ready:false,recognition:'Whisper offline',speech:'Piper offline',local:true}));
      return send(res,200,{...local,nova:fishStatus(),apex:apexVoiceStatus()});
    }
    if (req.method === 'GET' && path === '/training/export') return send(res,200,exportCorrections(store));
    if (req.method === 'GET' && path === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
      const push = () => { if (!res.destroyed) res.write(`data: ${JSON.stringify(engine.status())}\n\n`); };
      push(); const timer = setInterval(push, 1500); res.on('close', () => clearInterval(timer)); return;
    }
    if (req.method !== 'POST') return send(res, 404, { error: 'Runtime route not found.' });
    if (stopping) return send(res, 503, { error: 'Runtime is stopping.' });
    const body = await json(req);
    if(path==='/checks/stream'){
      if(engine.checking)throw new InputError('A system check is already running.',409);
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform',Connection:'keep-alive'});
      const emit=value=>{if(!res.destroyed)res.write(`data: ${JSON.stringify(value)}\n\n`);};
      try{await runDiagnostics(engine,{onUpdate:report=>emit({type:'report',report})});}
      catch{emit({type:'error',error:'The system check could not finish. Review the runtime and try again.'});}
      res.end();return;
    }
    if (path === '/training') return send(res,201,saveCorrection(store,body));
    if (path === '/voice/speak' && body.assistant === 'NOVA') return send(res,200,await fishSpeak(body));
    if (path === '/voice/speak' && body.assistant === 'APEX') {
      const request=new AbortController(),closed=()=>{if(!res.writableEnded)request.abort();};res.on('close',closed);
      try{return send(res,200,await fishSpeak(body,{signal:AbortSignal.any([request.signal,AbortSignal.timeout(120000)])}));}
      finally{res.removeListener('close',closed);}
    }
    if (path === '/voice/flux/start') return send(res,201,await flux.start({continuous:body.continuous===true}));
    if (path === '/voice/flux/audio') return send(res,200,flux.audio(body));
    if (path === '/voice/flux/stop') {flux.stop(text(body.id,'Session ID',80));return send(res,200,{stopped:true});}
    if (path === '/voice/transcribe' || path === '/voice/speak') return send(res,200,await voiceRequest(path.split('/').at(-1),body,token));
    if (path === '/checks') { if (engine.checking) throw new InputError('A system check is already running.', 409); return send(res, 200, await runDiagnostics(engine)); }
    if(path==='/loops/create')return send(res,201,engine.loops.create(body));
    if(path==='/loops/control')return send(res,200,engine.loops.control(body));
    if(path==='/loops/update')return send(res,200,engine.loops.update(body));
    if(path==='/loops/approve')return send(res,200,engine.loops.approve(body));
    if(path==='/loops/history')return send(res,200,engine.loops.getHistory(text(body.id,'Loop ID',80)));
    if(path==='/loops/notifications')return send(res,200,engine.loops.notification(body));
    if (path === '/personality') return send(res,200,engine.updatePersonality(body));
    if(path==='/chat/stream'){
      const request=new AbortController();
      const closed=()=>{if(!res.writableEnded)request.abort(new Error('Conversation connection closed.'));};
      res.on('close',closed);
      res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'});
      const emit=value=>{if(!res.destroyed){if(res.writableLength>1000000){request.abort();res.destroy();return;}res.write(JSON.stringify(value)+'\n');}};
      try{const reply=await engine.chat(body,{replace:true,signal:request.signal,onText:text=>emit({type:'delta',text})});if(!request.signal.aborted)emit({type:'done',reply});}
      catch(error){if(!request.signal.aborted)emit({type:'error',error:error instanceof Error?error.message:'Conversation failed.'});}
      finally{res.end();res.removeListener('close',closed);}return;
    }
    if(path==='/conversation'){const id=text(body.conversationId,'Conversation ID',80);if(!/^[a-zA-Z0-9-]+$/.test(id))throw new InputError('Invalid conversation ID.');return send(res,200,store.get('conversation',id)||{id,contents:[]});}
    if(path==='/task-notifications')return send(res,200,engine.claimTaskNotice(body));
    if (path === '/chat') return send(res, 200, await engine.chat(body));
    if (path === '/nodes/run') return send(res,201,engine.nodeTask(body));
    if (path === '/nodes/approve') return send(res,201,await engine.approveNode(body));
    if (path === '/stop-chat') {
      const id = text(body.conversationId, 'Conversation ID', 80);
      const controller = engine.chatControllers.get(id);
      if (controller) controller.abort(new Error('Conversation stopped by user.'));
      return send(res, 200, { stopped: Boolean(controller) });
    }
    if (path === '/tasks') return send(res, 201, engine.enqueue(body));
    if (path === '/workflows') return send(res, 200, engine.saveWorkflow(body));
    if (path === '/cancel') return send(res, 200, engine.cancel(text(body.id, 'Task ID', 80)));
    if (path === '/retry') return send(res, 201, engine.retry(text(body.id, 'Task ID', 80)));
    if (path === '/acknowledge') {
      const task = store.get('task', text(body.id, 'Task ID', 80));
      if (!task) throw new InputError('Task not found.', 404);
      return send(res, 200, engine.update(task, { acknowledged: true }));
    }
    if (path === '/memory') return send(res, 201, store.create('memory', { text: text(body.text, 'Memory', 8000), source: 'Memory panel', category: 'user_fact' }));
    if (path === '/delete-memory') {
      return send(res,202,engine.nodeTask({agent:'memory',message:'Delete the selected memory',toolInput:{operation:'delete',id:text(body.id,'Memory ID',80)}}));
    }
    if (path === '/edit-memory') {
      const memory = store.get('memory', text(body.id, 'Memory ID', 80));
      if (!memory) throw new InputError('Memory not found.', 404);
      return send(res, 200, store.put('memory', { ...memory, text: text(body.text, 'Memory', 8000), updatedAt: new Date().toISOString() }));
    }
    return send(res, 404, { error: 'Runtime route not found.' });
  } catch (error) {
    send(res, error instanceof InputError || [400,404,409,429,503].includes(error?.status) ? error.status : 502, { error: error instanceof Error ? error.message : 'Runtime request failed.' });
  }
});
const timer = setInterval(() => { engine.lastWorkerHeartbeat = Date.now(); flux.sweep(); if(!stopping)engine.loops.tick().catch(()=>console.error('Loop scheduler could not save progress.')); if (!stopping) engine.tick().catch(() => console.error('Task state could not be saved. Check the data directory.')); }, 400);
const port = Number(process.env.APEX_RUNTIME_PORT || 8081);
server.listen(port, '127.0.0.1', () => console.log(`APEX local runtime ready on 127.0.0.1:${port}; model ${engine.status().model}; configured: ${engine.status().configured}`));
async function shutdown() {
  if (stopping) return;
  stopping = true; clearInterval(timer);
  flux.close();
  const stopped = Promise.all([engine.stop(),engine.loops.stop(),engine.youtubeController?.close(),engine.browserController?.close()]);
  server.close(); server.closeAllConnections();
  const deadline = Date.now() + 3000;
  while ((engine.workers.size || engine.loops.workers.size || engine.loops.polling || engine.chatLocks.size || engine.checking) && Date.now() < deadline) await new Promise(r => setTimeout(r, 25));
  // If an adapter ignores cancellation, exit without closing a database it may still use.
  if (!engine.workers.size && !engine.loops.workers.size && !engine.loops.polling && !engine.chatLocks.size && !engine.checking) { await stopped; store.close(); }
  process.exit(0);
}
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
