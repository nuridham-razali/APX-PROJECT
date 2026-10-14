import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,brainConfig} from '../runtime/provider.mjs';
import {Store} from '../runtime/store.mjs';
import {saveCorrection,exportCorrections} from '../runtime/training.mjs';
import {sameLocalOrigin} from '../lib/local-origin.mjs';

test('local proxy permits the same app port through loopback aliases, blocks other origins',()=>{
  assert.equal(sameLocalOrigin('http://127.0.0.1:3000','http://localhost:3000'),true);
  for(const origin of ['http://example.com:3000','http://localhost:4000','https://localhost:3000','null'])assert.equal(sameLocalOrigin(origin,'http://localhost:3000'),false);
});

test('Ollama uses local chat, preserves history, requests JSON when needed and ignores thinking',async()=>{
  let payload;
  const result=await generate([{role:'user',parts:[{text:'First'}]},{role:'model',parts:[{text:'Answer'}]}],'Local system',{env:{APEX_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3:1.7b'},format:'json',fetcher:async(url,request)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');payload=JSON.parse(request.body);assert.equal(request.headers['x-goog-api-key'],undefined);return Response.json({message:{content:'Visible answer',thinking:'private'}});}});
  assert.equal(result.text,'Visible answer');assert.equal(payload.messages[2].role,'assistant');assert.equal(payload.think,false);assert.equal(payload.format,'json');assert.equal(payload.stream,false);
});
test('local inference rejects remote endpoints and cloud tags, and never retries a paid provider',async()=>{
  assert.throws(()=>brainConfig({APEX_PROVIDER:'ollama',OLLAMA_URL:'https://example.com'}),/local HTTP/);
  assert.throws(()=>brainConfig({APEX_PROVIDER:'ollama',OLLAMA_MODEL:'qwen:cloud'}),/local Ollama/);
  let calls=0;
  await assert.rejects(generate([], '',{env:{APEX_PROVIDER:'ollama',GEMINI_API_KEY:'must-not-use'},fetcher:async()=>{calls++;throw new Error('offline');}}),/Local Ollama/);
  assert.equal(calls,1);
});
test('training export includes only explicitly approved corrected turns and rejects stale replies',()=>{
  const store=new Store(':memory:');
  try{
    store.put('conversation',{id:'fixture',contents:[{role:'user',parts:[{text:'Question'}]},{role:'model',parts:[{text:'Wrong answer'}]}]});
    store.create('memory',{text:'Unrelated private fact'});
    store.create('training',{approved:false,prompt:'Unapproved secret'});
    assert.throws(()=>saveCorrection(store,{conversationId:'fixture',original:'Stale answer',correction:'New'}),/newer reply/);
    saveCorrection(store,{conversationId:'fixture',original:'Wrong answer',correction:'Correct answer',assistant:'NOVA'});
    const exported=exportCorrections(store);assert.equal(exported.count,1);const row=JSON.parse(exported.dataset.trim());assert.equal(row.messages.at(-1).content,'Correct answer');assert.doesNotMatch(exported.dataset,/Unrelated private fact|Unapproved secret|Wrong answer/);
  }finally{store.close();}
});
