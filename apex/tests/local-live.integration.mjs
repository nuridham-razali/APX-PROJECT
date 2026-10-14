// Explicit live check: local services only; synthetic speech, no microphone capture.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {Engine} from '../runtime/engine.mjs';
import {Store} from '../runtime/store.mjs';
const root='http://127.0.0.1:3000/api/runtime';
const state=await fetch(root+'/state').then(r=>r.json());
assert.equal(state.provider,'ollama');assert.equal(state.model,'qwen2.5:7b');
const ready=await fetch(root+'/voice/status').then(r=>r.json());assert.equal(ready.ready,true);
async function post(path,body){const res=await fetch(root+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});const result=await res.json();if(!res.ok)throw new Error(result.error);return result;}
const voice=await post('/voice/speak',{text:'Hello Nova. Please say ready.'});
const wav=Buffer.from(voice.audio,'base64');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.ok(wav.length>1000);
await mkdir('.apex-data/verification',{recursive:true});await writeFile('.apex-data/verification/local-voice.wav',wav);
const heard=await post('/voice/transcribe',{audio:voice.audio,language:'English'});
assert.match(heard.text,/hello|nova|ready/i);
console.log('Piper → WAV → Whisper round trip passed:',heard.text);
const reply=await post('/chat',{conversationId:'local-integration-verification',assistant:'NOVA',message:'This is a local integration test. Say hello in one short sentence and name yourself.'});
assert.ok(reply.message.trim());assert.equal(reply.model,'qwen2.5:7b');
console.log('Live Ollama Qwen reply passed:',reply.message);
const store=new Store(':memory:');
try{
  const engine=new Engine(store,{env:{APEX_PROVIDER:'ollama',OLLAMA_MODEL:'qwen2.5:7b'}});
  const task=engine.enqueue({mode:'closed_loop',assistant:'NOVA',message:'Write one short sentence summarizing the supplied source. Use only the source, with one text step.',source:'APEX uses Qwen locally through Ollama.'});
  await engine.tick();await Promise.all([...engine.workers.values()].map(worker=>worker.promise));
  const done=store.get('task',task.id);assert.equal(done.state,'completed',done.error);assert.ok(done.steps.some(step=>step.checks?.some(check=>check.passed)));
  console.log('Live Qwen task loop passed: planning, execution, result review.');
}finally{store.close();}
