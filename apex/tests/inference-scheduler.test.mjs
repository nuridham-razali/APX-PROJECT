import test from 'node:test';
import assert from 'node:assert/strict';
import {InferenceScheduler} from '../runtime/inference-scheduler.mjs';
import {Engine} from '../runtime/engine.mjs';
import {Store} from '../runtime/store.mjs';
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};

test('background cannot occupy the reserved conversation slot; foreground goes ahead of waiting work',async()=>{
  const calls=[],gates=new Map();
  const queue=new InferenceScheduler(async(_,name)=>{calls.push(name);const gate=deferred();gates.set(name,gate);await gate.promise;return{text:name};});
  const bg1=queue.run([],'background-one');const bg2=queue.run([],'background-two');await settle();
  assert.deepEqual(calls,['background-one']);assert.equal(queue.status().waitingBackground,1);
  const fg1=queue.run([],'foreground-one',{priority:'foreground'});await settle();assert.deepEqual(calls,['background-one','foreground-one']);
  const fg2=queue.run([],'foreground-two',{priority:'foreground'});
  gates.get('foreground-one').resolve();await fg1;await settle();assert.equal(calls.at(-1),'foreground-two');assert.equal(queue.status().activeBackground,1);
  gates.get('foreground-two').resolve();await fg2;await settle();assert.equal(calls.includes('background-two'),false);
  gates.get('background-one').resolve();await bg1;await settle();assert.equal(calls.at(-1),'background-two');
  gates.get('background-two').resolve();await bg2;await settle();assert.equal(queue.status().activeBackground,0);
  assert.doesNotMatch(JSON.stringify(queue.status()),/background-one|foreground-two/);
});

test('cancelling waiting inference removes its request without ever invoking the provider',async()=>{
  const gate=deferred(),calls=[];const queue=new InferenceScheduler(async(_,name)=>{calls.push(name);await gate.promise;return{text:name};});
  const active=queue.run([],'active');const controller=new AbortController();const waiting=queue.run([],'cancelled',{signal:controller.signal});
  const rejected=assert.rejects(waiting,/User stopped/);controller.abort(new Error('User stopped'));await rejected;
  assert.equal(queue.status().waitingBackground,0);gate.resolve();await active;await settle();assert.deepEqual(calls,['active']);
});

test('active cancellation holds its slot until the provider settles and discards late output',async()=>{
  const gate=deferred();let count=0;const queue=new InferenceScheduler(async()=>{count++;if(count===1)await gate.promise;return{text:'late output'};});
  const controller=new AbortController();const active=queue.run([],'active',{signal:controller.signal});await settle();
  const rejected=assert.rejects(active,/Stopped/);controller.abort(new Error('Stopped'));
  const next=queue.run([],'next');await settle();assert.equal(count,1);assert.equal(queue.status().activeBackground,1);
  gate.resolve();await rejected;await next;await settle();assert.equal(count,2);
});

test('provider failure releases a slot and shutdown cancels active and queued work',async()=>{
  let count=0;const queue=new InferenceScheduler(async(_,name,{signal})=>{count++;if(name==='fail')throw Error('Provider failed');return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
  await assert.rejects(queue.run([],'fail'),/Provider failed/);await settle();
  const active=queue.run([],'active');const waiting=queue.run([],'waiting');await settle();
  const rejected=[assert.rejects(active,/scheduler stopped/),assert.rejects(waiting,/scheduler stopped/)];queue.close();await Promise.all(rejected);await settle();assert.equal(count,2);
  await assert.rejects(queue.run([],'new'),/scheduler is stopped/);assert.equal(queue.status().activeBackground,0);
});

test('local engine routes ordinary conversation through priority while two task workers are occupied',async()=>{
  const store=new Store(':memory:');const gates=[],calls=[];
  const engine=new Engine(store,{env:{APEX_PROVIDER:'ollama',OLLAMA_MODEL:'fixture-local'},generator:async(contents)=>{
    const input=contents.at(-1).parts[0].text;calls.push(input);
    if(input.startsWith('Task:')){const gate=deferred();gates.push(gate);await gate.promise;return{text:'Fixture task result'};}
    return{text:'Conversation remains available'};
  }});
  try{
    engine.enqueue({message:'First fixture'});engine.enqueue({message:'Second fixture'});const work=engine.tick();await settle();
    assert.equal(engine.workers.size,2);assert.equal(calls.length,1);assert.equal(engine.status().inference.waitingBackground,1);
    const reply=await engine.chat({message:'Hello NOVA',assistant:'NOVA',conversationId:'priority-fixture'});assert.equal(reply.message,'Conversation remains available');
    gates[0].resolve();await settle();assert.equal(gates.length,2);gates[1].resolve();await work;await settle();
    assert.equal(store.list('task').every(t=>t.state==='completed'),true);
  }finally{await engine.stop();store.close();}
});

test('invalid admission limits and priorities fail before provider work',async()=>{
  for(const options of [{limit:1},{limit:4},{limit:2,backgroundLimit:2},{limit:2,backgroundLimit:0}])assert.throws(()=>new InferenceScheduler(()=>{},options),/Inference limits/);
  const queue=new InferenceScheduler(()=>{throw Error('Must not run');});await assert.rejects(queue.run([],'',{priority:'other'}),/Unknown inference priority/);
});
