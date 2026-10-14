import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../runtime/provider.mjs';
import {Store} from '../runtime/store.mjs';
import {Engine} from '../runtime/engine.mjs';
import {jsonLines} from '../lib/json-stream.mjs';
import {SentenceBuffer,SpeechQueue,streamConversation} from '../lib/realtime-conversation.mjs';
const encoder=new TextEncoder(),line=value=>encoder.encode(JSON.stringify(value)+'\n');
const settle=async()=>{for(let i=0;i<50;i++)await Promise.resolve();};

test('Ollama streams visible tokens before completion and never forwards thinking fields',async()=>{
 let finish,started;const ready=new Promise(r=>started=r),chunks=[];let wire;
 const result=generate([{role:'user',parts:[{text:'Fixture'}]}],'Fixture',{env:{APEX_PROVIDER:'ollama',OLLAMA_MODEL:'qwen2.5:3b'},onText:t=>{chunks.push(t);started();},fetcher:async(url,options)=>{assert.equal(JSON.parse(options.body).stream,true);return new Response(new ReadableStream({start(c){wire=c;c.enqueue(line({message:{content:'Hello ',thinking:'private'},done:false}));finish=()=>{c.enqueue(line({message:{content:'world.'},done:true}));c.close();};}}));}});
 await ready;assert.deepEqual(chunks,['Hello ']);finish();assert.equal((await result).text,'Hello world.');assert.doesNotMatch(chunks.join(''),/private/);
});
test('stream parser handles split UTF-8 and rejects truncated provider completion',async()=>{
 const bytes=line({text:'你好'}),stream=new ReadableStream({start(c){for(const b of bytes)c.enqueue(new Uint8Array([b]));c.close();}});const rows=[];for await(const row of jsonLines(stream))rows.push(row);assert.equal(rows[0].text,'你好');
 await assert.rejects(generate([], '',{env:{APEX_PROVIDER:'ollama'},onText:()=>{},fetcher:async()=>new Response(line({message:{content:'partial'},done:false}))}),/interrupted/);
});
test('streaming engine preserves selected model/personality/history, cancellation saves no fabricated completed turn',async()=>{
 const store=new Store(':memory:');let begin;const began=new Promise(r=>begin=r),abort=new AbortController();
 const engine=new Engine(store,{env:{APEX_PROVIDER:'ollama',OLLAMA_MODEL:'qwen2.5:3b'},generator:async(contents,instruction,options)=>{assert.match(instruction,/User-facing communication profile/i);options.onText('Partial answer');begin();await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}});
 const chunks=[];try{const reply=engine.chat({message:'Hello fixture',conversationId:'stream-fixture'},{signal:abort.signal,onText:t=>chunks.push(t)});await began;assert.deepEqual(chunks,['Partial answer']);abort.abort(new Error('Fixture disconnected'));await assert.rejects(reply,/disconnected/);assert.ok(!store.get('conversation','stream-fixture'));assert.equal(engine.chatLocks.size,0);}finally{await engine.stop();store.close();}
});
test('transport emits deltas and handles local replies, errors, and incomplete streams',async()=>{
 const received=[];const response=await streamConversation({},{fetcher:async()=>new Response(new Uint8Array([...line({type:'delta',text:'Hello.'}),...line({type:'done',reply:{message:'Hello.'}})])),onText:(delta,full)=>received.push(full)});assert.equal(response.message,'Hello.');assert.deepEqual(received,['Hello.']);
 const local=[];await streamConversation({},{fetcher:async()=>new Response(line({type:'done',reply:{message:'Local command reply'}})),onText:t=>local.push(t)});assert.deepEqual(local,['Local command reply']);
 await assert.rejects(streamConversation({},{fetcher:async()=>new Response(line({type:'error',error:'Fixture failure'}))}),/Fixture failure/);
 await assert.rejects(streamConversation({},{fetcher:async()=>new Response(line({type:'delta',text:'Partial'}))}),/before the reply completed/);
});
test('sentence buffering starts before the final answer and caps voice text/calls',()=>{
 const chunks=[],buffer=new SentenceBuffer(t=>chunks.push(t));buffer.push('Here is the first sentence. ');assert.deepEqual(chunks,['Here is the first sentence.']);buffer.push('A second unfinished');assert.equal(chunks.length,1);buffer.finish();assert.equal(chunks[1],'A second unfinished');
 const bounded=[],large=new SentenceBuffer(t=>bounded.push(t));large.push('This is a bounded sentence. '.repeat(200));large.finish();assert.ok(bounded.length<=8);assert.ok(bounded.join('').length<=1500);
});
test('speech prepares at most one segment ahead, plays in order, and drops interrupted audio',async()=>{
 const controller=new AbortController(),prepared=[],played=[];let finishPlay;
 const queue=new SpeechQueue({signal:controller.signal,prepare:async text=>{prepared.push(text);return text;},play:file=>{played.push(file);return new Promise(r=>finishPlay=r);}});
 queue.add('one');queue.add('two');queue.add('three');await settle();assert.deepEqual(prepared,['one','two']);assert.deepEqual(played,['one']);controller.abort();finishPlay();await assert.rejects(queue.finish(),{name:'AbortError'});assert.deepEqual(played,['one']);assert.deepEqual(prepared,['one','two']);
});
test('speech preparation failures are surfaced without replay or retries',async()=>{
 let calls=0,error;const controller=new AbortController(),queue=new SpeechQueue({signal:controller.signal,prepare:async()=>{calls++;throw Error('Fixture TTS unavailable');},play:()=>assert.fail('Must not play'),onError:e=>error=e});queue.add('hello');await assert.rejects(queue.finish(),/TTS unavailable/);assert.equal(calls,1);assert.match(error.message,/TTS unavailable/);
});


test('new conversational turn waits for interrupted generation to release its lock and saves only the new reply',async()=>{
 const store=new Store(':memory:');let calls=0,started;const began=new Promise(r=>started=r);
 const engine=new Engine(store,{env:{APEX_PROVIDER:'ollama',OLLAMA_MODEL:'qwen2.5:3b'},generator:async(contents,instruction,options)=>{if(++calls===1){started();await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}return {text:'New reply',model:'qwen2.5:3b'};}});
 try{const old=engine.chat({message:'First question',conversationId:'handoff-fixture'}).catch(e=>e);await began;const fresh=await engine.chat({message:'New question',conversationId:'handoff-fixture'},{replace:true});assert.equal(fresh.message,'New reply');assert.match((await old).message,/Interrupted/);assert.equal(calls,2);const saved=store.get('conversation','handoff-fixture');assert.equal(saved.contents.length,2);assert.equal(saved.contents[0].parts[0].text,'New question');assert.equal(engine.chatSettlements.size,0);}finally{await engine.stop();store.close();}
});
