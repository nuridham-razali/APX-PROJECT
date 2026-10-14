import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../runtime/engine.mjs';
import {Store} from '../runtime/store.mjs';
const env={APEX_PROVIDER:'ollama',OLLAMA_MODEL:'fixture-local'};
test('wake-only chat cannot retrieve history, invoke inference or create tasks',async t=>{
 let calls=0;const {engine,store}=fixture(t,async()=>{calls++;throw Error('Wake must not use model');});
 store.put('conversation',{id:'old',contents:[{role:'model',parts:[{text:'Previous private discussion'}]}]});
 for(const message of ['Apex','Hey Apex!','Apex, Apex.']){const reply=await engine.chat({message,conversationId:'old',assistant:'APEX'});assert.equal(reply.message,"I'm here, Idham.");assert.equal(reply.wakeOnly,true);}
 assert.equal(calls,0);assert.equal(store.list('task').length,0);assert.equal(store.get('conversation','old').contents.length,1);
});
function fixture(t,generator){const store=new Store(':memory:');const engine=new Engine(store,{env,generator:generator||(async(_,__,o)=>({text:o.format==='json'?'{"opener":"Happy to help."}':'Verified mock result'}))});t.after(async()=>{await engine.stop();store.close();});return {engine,store};}
test('acceptance uses personality generation but execution facts override fabricated progress',async t=>{
 let instruction;const {engine,store}=fixture(t,async(_,s)=>{instruction=s;return{text:'{"opener":"I finished it in 2 minutes."}'};});
 const reply=await engine.chat({message:'Draft a short report',conversationId:'one'});
 assert.match(reply.message,/Queued.*Waiting for background worker/);assert.doesNotMatch(reply.message,/finished|minutes/);assert.match(instruction,/Sarcasm|SARCASM|sarcasm/);
 assert.equal(store.get('task',reply.taskId).conversationId,'one');assert.equal(store.get('conversation','one').contents.at(-1).parts[0].text,reply.message);
});
test('two tasks remain independent while unrelated conversation and honest status complete',async t=>{
 let release,started;const gate=new Promise(r=>release=r),began=new Promise(r=>started=r);
 const {engine,store}=fixture(t,async(contents,__,o)=>{if(o.format==='json')return{text:'{"opener":"Glad to help."}'};if(contents.at(-1).parts[0].text==='Hello')return{text:'Foreground mock answer'};started();await Promise.race([gate,new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(o.signal.reason),{once:true}))]);return{text:'Completed mock draft'};});
 const first=await engine.chat({message:'Write a report about A',conversationId:'one'});const work=engine.tick();await began;
 const second=await engine.chat({message:'Draft a report about B',conversationId:'one'});assert.notEqual(first.taskId,second.taskId);
 assert.equal((await engine.chat({message:'Hello',conversationId:'one'})).message,'Foreground mock answer');
 assert.match((await engine.chat({message:'Is it ready?',conversationId:'one'})).message,/Which task/);
 assert.match((await engine.chat({message:'What is still running?',conversationId:'one'})).message,/queued.*in progress/s);
 assert.equal(store.get('task',first.taskId).state,'running');release();await work;
});
test('status and natural cancellation cannot target another conversation',async t=>{
 const {engine,store}=fixture(t);const a=await engine.chat({message:'Draft a memo',conversationId:'one'});
 assert.match((await engine.chat({message:'Is it ready?',conversationId:'two'})).message,/do not have/);
 await engine.chat({message:`Cancel task ${a.taskId}`,conversationId:'two'});assert.equal(store.get('task',a.taskId).state,'queued');
 await engine.chat({message:'Cancel that task',conversationId:'one'});assert.equal(store.get('task',a.taskId).state,'cancelled');
});
test('queued amendments update handler instructions without rewriting a running task',async t=>{
 const {engine,store}=fixture(t);const a=await engine.chat({message:'Draft a memo',conversationId:'one'});
 await engine.chat({message:`Update task ${a.taskId} to Proofread this sentence`,conversationId:'one'});
 assert.equal(store.get('task',a.taskId).steps[0].agent,'editor');engine.update(store.get('task',a.taskId),{state:'running'});
 assert.match((await engine.chat({message:`Change task ${a.taskId} to Research alternatives`,conversationId:'one'})).message,/Cancel it explicitly/);
 assert.equal(store.get('task',a.taskId).request,'Proofread this sentence');
});
test('real handler settlement creates one canonical notice and an atomic conversation-history claim',async t=>{
 const {engine,store}=fixture(t);const reply=await engine.chat({message:'Draft a simple memo',conversationId:'one'});await engine.tick();
 const notice=engine.status().taskNotifications[0];assert.match(notice.text,/Completed.*\nVerified mock result/s);assert.equal(notice.taskId,reply.taskId);
 assert.throws(()=>engine.claimTaskNotice({id:notice.id,conversationId:'other'}),/not found/);
 assert.equal(engine.claimTaskNotice({id:notice.id,conversationId:'one'}).text,notice.text);
 assert.equal(store.get('conversation','one').contents.at(-1).parts[0].text,notice.text);
 assert.throws(()=>engine.claimTaskNotice({id:notice.id,conversationId:'one'}),/already delivered/);assert.equal(engine.status().taskNotifications.length,0);
});
test('unconfigured integration and provider failure cannot emit successful completion',async t=>{
 const {engine}=fixture(t,async(_,__,o)=>{if(o.format==='json')return{text:'{"opener":"Happy to help."}'};throw Error('Mock provider unavailable');});
 const blocked=await engine.chat({message:'Summarize my inbox',conversationId:'one'});assert.match(blocked.message,/Blocked.*Not configured/s);
 await engine.chat({message:'Draft a memo',conversationId:'one'});await engine.tick();const notice=engine.status().taskNotifications.at(0);assert.match(notice.text,/Failed.*Mock provider unavailable/s);assert.doesNotMatch(notice.text,/Completed/);
});
test('restart preserves queued work and exposes interrupted work as blocked with a notice',t=>{
 const {engine,store}=fixture(t);const a=engine.enqueue({message:'Draft A',conversationId:'one'}),b=engine.enqueue({message:'Draft B',conversationId:'one'});engine.update(a,{state:'running'});
 const recovered=new Engine(store,{env,generator:async()=>{throw Error('Must not run');}});
 assert.equal(store.get('task',a.id).state,'awaiting_input');assert.equal(store.get('task',b.id).state,'queued');assert.match(recovered.status().taskNotifications[0].text,/Blocked.*Interrupted/s);
});
