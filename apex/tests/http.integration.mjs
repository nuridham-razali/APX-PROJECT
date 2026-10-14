import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const cwd=fileURLToPath(new URL('..', import.meta.url));
async function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});}
const uiPort=await freePort();const runtimePort=await freePort();
const dir=mkdtempSync(join(tmpdir(),'apex-http-'));
const env={...process.env,APEX_PROVIDER:'gemini',GEMINI_API_KEY:'',APEX_DATA_DIR:dir,APEX_RUNTIME_PORT:String(runtimePort)};
const runtime=spawn(process.execPath,['runtime/server.mjs'],{cwd,env,stdio:'pipe'});
const next=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(uiPort)],{cwd,env,stdio:'pipe'});
runtime.stderr.on('data',d=>process.stderr.write(d));next.stderr.on('data',d=>process.stderr.write(d));
const root=`http://127.0.0.1:${uiPort}`;
try {
 let ready=false;for(let i=0;i<100;i++){try{const response=await fetch(root+'/api/runtime/state');if(response.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready,'servers ready');
 const invalidHistory=await fetch(root+'/api/on-this-day?date=2026-02-30');assert.equal(invalidHistory.status,400);
 const oldWorkspace=await fetch(root+'/workspace',{redirect:'manual'});assert.equal(oldWorkspace.status,307);assert.equal(oldWorkspace.headers.get('location'),'/');
 const weatherMissing=await fetch(root+'/api/weather');assert.equal(weatherMissing.status,400);
 const weatherInvalid=await fetch(root+'/api/weather?latitude=999&longitude=1');assert.equal(weatherInvalid.status,400);
 const state=await fetch(root+'/api/runtime/state');assert.equal(state.status,200);const snapshot=await state.json();assert.equal(snapshot.configured,false);assert.equal(snapshot.backgroundConcurrency,2);assert.deepEqual(snapshot.activeTasks,[]);
 assert.equal((await fetch(`http://127.0.0.1:${runtimePort}/state`)).status,401);
 const postPersonality=body=>fetch(root+'/api/runtime/personality',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal(snapshot.personality.preset,'Default');
 const personality=await postPersonality({revision:0,action:{preset:'TARS'}});assert.equal(personality.status,200);assert.equal((await personality.json()).levels.sarcasm,5);
 assert.equal((await postPersonality({revision:0,action:{preset:'Board'}})).status,409);
 assert.equal((await postPersonality({action:{setting:'permissions',level:5}})).status,400);
 const settingsCommand=await fetch(root+'/api/runtime/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Be warmer',conversationId:'local-personality'})});assert.equal(settingsCommand.status,200);const settingsReply=await settingsCommand.json();assert.equal(settingsReply.local,true);assert.equal(settingsReply.personality.levels.warmth,3);
 const settingsState=await fetch(root+'/api/runtime/state').then(r=>r.json());assert.equal(settingsState.personality.preset,'Custom');assert.equal(settingsState.personality.revision,2);
 const crossPersonality=await fetch(root+'/api/runtime/personality',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({action:{preset:'Default'}})});assert.equal(crossPersonality.status,403);

 const restored=await fetch(root+'/api/runtime/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:'empty-fixture'})});assert.equal(restored.status,200);assert.deepEqual((await restored.json()).contents,[]);
 const missingNotice=await fetch(root+'/api/runtime/task-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'absent-fixture',conversationId:'empty-fixture'})});assert.equal(missingNotice.status,404);
 const crossNotice=await fetch(root+'/api/runtime/task-notifications',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({id:'absent-fixture',conversationId:'empty-fixture'})});assert.equal(crossNotice.status,403);
 const stopped=await fetch(root+'/api/runtime/stop-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:'inactive-fixture'})});assert.equal(stopped.status,200);assert.equal((await stopped.json()).stopped,false);
 const wrongOrigin=await fetch(root+'/api/runtime/memory',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://untrusted.example'},body:JSON.stringify({text:'blocked fixture'})});assert.equal(wrongOrigin.status,403);
 const missingKey=await fetch(root+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Hello'})});assert.equal(missingKey.status,502);assert.match((await missingKey.json()).error,/GEMINI_API_KEY/);
 const noTask=await fetch(root+'/api/runtime/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Fixture task'})});assert.equal(noTask.status,503);
 const noLoop=await fetch(root+'/api/runtime/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Summarise fixture notes',source:'Fixture source only.',mode:'closed_loop'})});assert.equal(noLoop.status,503);assert.match((await noLoop.json()).error,/not configured/);
 const noLoopChat=await fetch(root+'/api/runtime/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'/loop Summarise fixture notes',conversationId:'loop-missing-key'})});assert.equal(noLoopChat.status,503);
 assert.equal((await (await fetch(root+'/api/runtime/state')).json()).tasks.length,0);
 const memory=await fetch(root+'/api/runtime/memory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'HTTP fixture'})});assert.equal(memory.status,201);const m=await memory.json();
 assert.equal(snapshot.nodes.length,18);
 const postNode=body=>fetch(root+'/api/runtime/nodes/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const finance=await postNode({agent:'finance',message:'Calculate fixture amounts',toolInput:{items:[{type:'income',amount:100},{type:'expense',amount:35}]}});assert.equal(finance.status,201);const f=await finance.json();
 const pending=await postNode({agent:'memory',message:'Delete the fixture memory',toolInput:{operation:'delete',id:m.id}});assert.equal(pending.status,201);assert.ok((await pending.json()).approval);
 const forged=await fetch(root+'/api/runtime/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'agents',agent:'memory',message:'Delete memory',toolInput:{operation:'delete',id:m.id},approvalReceipt:'fake'})});assert.equal(forged.status,409);
 let done;for(let i=0;i<30;i++){const state=await fetch(root+'/api/runtime/state').then(r=>r.json());done=state.tasks.find(t=>t.id===f.id);if(done.state==='completed')break;await new Promise(r=>setTimeout(r,100));}assert.equal(done.state,'completed');assert.equal(JSON.parse(done.result).net,65);
 const recall=await fetch(root+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'/recall HTTP'})});assert.equal(recall.status,200);assert.match((await recall.json()).message,/HTTP fixture/);
 const check=await fetch(root+'/api/runtime/checks',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(check.status,200);const report=await check.json();assert.equal(report.checks.length,18);assert.equal(report.passed,10);assert.equal(report.checks.find(c=>c.id==='key').state,'failed');

 const postLoop=(path,body)=>fetch(root+'/api/runtime/loops/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const loopCreated=await postLoop('create',{template:'agents',title:'HTTP native loop',objective:'Calculate supplied verification figures',agents:['finance'],input:{items:[{type:'income',amount:100},{type:'expense',amount:35}]},limits:{maxApiCalls:0}});
 assert.equal(loopCreated.status,201);const nativeLoop=await loopCreated.json();assert.equal(nativeLoop.state,'Draft');
 assert.equal((await postLoop('control',{id:nativeLoop.id,action:'run'})).status,200);
 let loopState;for(let i=0;i<40;i++){loopState=(await fetch(root+'/api/runtime/state').then(r=>r.json())).loops.find(l=>l.id===nativeLoop.id);if(loopState.state==='Completed')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(loopState.state,'Completed');assert.equal(loopState.apiCalls,0);
 const loopHistory=await postLoop('history',{id:nativeLoop.id}).then(r=>r.json());assert.equal(loopHistory.runs[0].state,'Completed');assert.equal(loopHistory.outputs.find(o=>o.agent==='finance').result.net,65);
 const listLoops=await fetch(root+'/api/runtime/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'List my loops',conversationId:'loops-http'})});assert.equal(listLoops.status,200);assert.equal((await listLoops.json()).local,true);
 const recurring=await postLoop('create',{template:'agents',title:'HTTP recurring fixture',objective:'Measure native task analytics',agents:['analytics'],trigger:{type:'scheduled'},schedule:{kind:'interval',intervalMinutes:60},limits:{maxApiCalls:0}}).then(r=>r.json());assert.equal(recurring.state,'Scheduled');
 for(const [action,expected] of [['pause','Paused'],['resume','Scheduled'],['cancel','Cancelled']]){const r=await postLoop('control',{id:recurring.id,action});assert.equal(r.status,200);assert.equal((await r.json()).state,expected);}
 const blockedLoop=await fetch(root+'/api/runtime/loops/create',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({template:'services',objective:'Unauthorized fixture'})});assert.equal(blockedLoop.status,403);

 const streamLocal=await fetch(root+'/api/runtime/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'What are your personality settings?',conversationId:'stream-local'})});assert.match(streamLocal.headers.get('content-type'),/ndjson/);const localEvent=JSON.parse((await streamLocal.text()).trim());assert.equal(localEvent.type,'done');assert.equal(localEvent.reply.local,true);
 const streamError=await fetch(root+'/api/runtime/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Hello fixture',conversationId:'stream-missing-key'})});const failureEvent=JSON.parse((await streamError.text()).trim());assert.equal(failureEvent.type,'error');assert.match(failureEvent.error,/GEMINI_API_KEY/);
 const events=await fetch(root+'/api/runtime/events',{signal:AbortSignal.timeout(5000)});assert.equal(events.status,200);const reader=events.body.getReader();const eventFrame=new TextDecoder().decode((await reader.read()).value);assert.match(eventFrame,/^data: /);assert.match(eventFrame,/HTTP native loop/);await reader.cancel();
 const unknownTask=await fetch(root+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'/status deadbeef'})});assert.equal(unknownTask.status,404);
 console.log('HTTP integration passed: state, authentication, cross-origin rejection, missing-key handling, memory, recall, native loop execution, loop controls, local commands, SSE.');
}finally{next.kill('SIGTERM');await new Promise(r=>setTimeout(r,200));runtime.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));rmSync(dir,{recursive:true,force:true});}
