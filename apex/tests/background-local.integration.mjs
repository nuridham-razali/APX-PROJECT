// Explicit integration test: local Ollama only. No Fish/Deepgram/external requests.
import assert from 'node:assert/strict';
import {Engine} from '../runtime/engine.mjs';
import {Store} from '../runtime/store.mjs';
try{process.loadEnvFile('.env.local');}catch{}
assert.equal(process.env.APEX_PROVIDER,'ollama','This test refuses billable providers.');
const store=new Store(':memory:');
const engine=new Engine(store,{env:{APEX_PROVIDER:'ollama',OLLAMA_MODEL:process.env.OLLAMA_MODEL,OLLAMA_URL:process.env.OLLAMA_URL}});
try{
 const receipt=await engine.chat({message:'Draft one sentence about this supplied fact: APEX is a personal assistant. Use only that fact.',conversationId:'local-background-proof'});
 assert.ok(receipt.taskId);assert.equal(store.get('task',receipt.taskId).state,'queued');
 const execution=engine.tick();
 const stateAtQuestion=store.get('task',receipt.taskId).state;assert.equal(stateAtQuestion,'running');
 const reply=await engine.chat({message:'What is two plus two? Answer briefly.',conversationId:'local-background-proof'});assert.ok(reply.message.trim());
 await execution;const task=store.get('task',receipt.taskId);assert.equal(task.state,'completed',task.error);assert.ok(task.result.trim());
 const notice=engine.status().taskNotifications[0];assert.ok(notice.text.includes(task.result));engine.claimTaskNotice({id:notice.id,conversationId:'local-background-proof'});
 assert.equal(store.get('conversation','local-background-proof').contents.at(-1).parts[0].text,notice.text);
 console.log(JSON.stringify({provider:'ollama',model:task.model,stateAtQuestion,foreground:reply.message,background:task.result,canonicalHistory:true,externalCalls:0}));
}finally{await engine.stop();store.close();}
