import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {apexVoiceStatus,FluxSessions} from '../runtime/apex-voice.mjs';
import {FluxCapture} from '../lib/flux-capture.mjs';
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
test('APEX provider status is separate and never exposes credentials',()=>{
  const status=apexVoiceStatus({DEEPGRAM_API_KEY:'fixture-secret-one',FISH_API_KEY:'fixture-secret-two',APEX_FISH_VOICE_ID:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});
  assert.equal(status.ready,true);assert.equal(status.speechReady,true);assert.equal(status.voiceId,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');assert.equal(status.model,'flux-general-en');assert.doesNotMatch(JSON.stringify(status),/fixture-secret/);
  assert.equal(apexVoiceStatus({}).ready,false);
});
function fluxFixture(){let socket,options;const sessions=new FluxSessions({env:{DEEPGRAM_API_KEY:'fixture-server-key'},socketFactory:(url,protocols)=>{options={url,protocols};socket={sent:[],bufferedAmount:0,send(value){this.sent.push(value);},close(){this.onclose?.();}};queueMicrotask(()=>socket.onopen());return socket;}});return{sessions,get socket(){return socket;},get options(){return options;}};}
test('Flux streams mono PCM on v2 and delivers EndOfTurn once without interim-triggered execution',async()=>{
  const f=fluxFixture(),session=await f.sessions.start();assert.match(f.options.url,/v2\/listen\?model=flux-general-en&encoding=linear16&sample_rate=16000.*keyterm=APEX/);assert.deepEqual(f.options.protocols,['token','fixture-server-key']);assert.doesNotMatch(JSON.stringify(session),/fixture-server-key/);
  f.socket.onmessage({data:JSON.stringify({type:'TurnInfo',event:'Update',transcript:'interim'})});
  const audio=Buffer.alloc(5120).toString('base64');assert.equal(f.sessions.audio({id:session.id,audio}).events[0].event,'Update');assert.equal(f.socket.sent[0].length,5120);
  f.socket.onmessage({data:JSON.stringify({type:'TurnInfo',event:'EndOfTurn',transcript:'final request'})});f.socket.onmessage({data:JSON.stringify({type:'TurnInfo',event:'EndOfTurn',transcript:'duplicate'})});
  assert.deepEqual(f.sessions.audio({id:session.id,audio}).events,[{event:'EndOfTurn',transcript:'final request'}]);assert.equal(f.socket.sent.length,1);assert.deepEqual(f.sessions.audio({id:session.id}).events,[]);f.sessions.close();
});
test('Flux rejects malformed chunks, expires sessions, and bounds streaming backlog',async()=>{
  const f=fluxFixture(),session=await f.sessions.start();assert.throws(()=>f.sessions.audio({id:session.id,audio:'!'}),/Invalid/);assert.throws(()=>f.sessions.audio({id:session.id,audio:Buffer.alloc(3).toString('base64')}),/linear16/);
  f.socket.bufferedAmount=64001;assert.throws(()=>f.sessions.audio({id:session.id,audio:Buffer.alloc(2).toString('base64')}),/falling behind/);
  f.sessions.now=()=>Date.now()+60001;f.sessions.sweep();assert.equal(f.sessions.sessions.size,0);assert.throws(()=>f.sessions.audio({id:session.id}),/expired/);
});
test('provider stream errors are sanitized and missing Flux key does not connect',async()=>{
  await assert.rejects(new FluxSessions({env:{},socketFactory:()=>{throw Error('Should not connect');}}).start(),/DEEPGRAM_API_KEY/);
  await assert.rejects(new FluxSessions({env:{DEEPGRAM_API_KEY:'invalid=fixture-secret'},socketFactory:()=>{throw Error('Should not connect');}}).start(),e=>/invalid format/.test(e.message)&&!e.message.includes('fixture-secret'));
  const f=fluxFixture(),session=await f.sessions.start();f.socket.onmessage({data:JSON.stringify({type:'Error',description:'secret upstream data'})});assert.throws(()=>f.sessions.audio({id:session.id}),e=>!e.message.includes('secret upstream'));f.sessions.close();
});
test('PCM worklet emits exactly 160 ms of signed little-endian audio with clamped samples',()=>{
  let Processor;const output=[];const context={AudioWorkletProcessor:class{constructor(){this.port={postMessage:buffer=>output.push(buffer)};}},registerProcessor:(_,Class)=>{Processor=Class;}};
  vm.runInNewContext(readFileSync(new URL('../public/apex-pcm-worklet.js',import.meta.url),'utf8'),context);const worklet=new Processor();const samples=new Float32Array(2560);samples[0]=1;samples[1]=-1;samples[2]=2;
  worklet.process([[samples]]);assert.equal(output.length,1);assert.equal(output[0].byteLength,5120);const view=new DataView(output[0]);assert.equal(view.getInt16(0,true),32767);assert.equal(view.getInt16(2,true),-32768);assert.equal(view.getInt16(4,true),32767);
});
function captureFixture(fetcher){const tracks=[{stops:0,stop(){this.stops++;}}];const node={port:{onmessage:null},connect(){},disconnect(){}};const context={sampleRate:16000,audioWorklet:{addModule:async()=>{}},resume:async()=>{},close:async()=>{},destination:{},createMediaStreamSource:()=>({connect(){},disconnect(){}}),createGain:()=>({gain:{value:1},connect(){},disconnect(){}})};const turns=[],errors=[],transcripts=[];const capture=new FluxCapture({fetcher,getStream:async()=>({getTracks:()=>tracks}),getContext:()=>context,getNode:()=>node,onTurn:words=>turns.push(words),onError:e=>errors.push(e),onTranscript:t=>transcripts.push(t)});return{capture,node,tracks,turns,errors,transcripts};}
test('client executes only final Flux turns and releases the microphone before task submission',async()=>{
  let chunks=0;const f=captureFixture(async(url)=>{if(url.endsWith('/start'))return Response.json({id:'session'});if(url.endsWith('/stop'))return Response.json({stopped:true});return Response.json({events:[{event:++chunks===1?'Update':'EndOfTurn',transcript:chunks===1?'partial':'final'}]});});
  await f.capture.start();const emit=f.node.port.onmessage;emit({data:new ArrayBuffer(5120)});await settle();assert.deepEqual(f.turns,[]);assert.deepEqual(f.transcripts,['partial']);emit({data:new ArrayBuffer(5120)});await settle();assert.deepEqual(f.turns,['final']);assert.equal(f.tracks[0].stops,1);emit({data:new ArrayBuffer(5120)});await settle();assert.deepEqual(f.turns,['final']);
});
test('Stop suppresses a delayed final transcript and permission cancellation releases late streams',async()=>{
  let resolve;const held=new Promise(r=>{resolve=r;});const f=captureFixture(async(url)=>url.endsWith('/audio')?held:Response.json({id:'session'}));await f.capture.start();f.node.port.onmessage({data:new ArrayBuffer(5120)});await settle();f.capture.stop();resolve(Response.json({events:[{event:'EndOfTurn',transcript:'stale'}]}));await settle();assert.deepEqual(f.turns,[]);
  let streamResolve,stopped=0;const capture=new FluxCapture({getStream:()=>new Promise(r=>{streamResolve=r;})});const start=capture.start();capture.stop();streamResolve({getTracks:()=>[{stop(){stopped++;}}]});assert.equal(await start,false);assert.equal(stopped,1);
});


test('continuous Flux session accepts multiple indexed turns and deduplicates repeated final events',async()=>{
 const f=fluxFixture(),session=await f.sessions.start({continuous:true});
 for(const index of [0,1]){
  f.socket.onmessage({data:JSON.stringify({type:'TurnInfo',event:'StartOfTurn',turn_index:index})});
  for(let n=0;n<2;n++)f.socket.onmessage({data:JSON.stringify({type:'TurnInfo',event:'EndOfTurn',turn_index:index,transcript:'Final '+index})});
 }
 const events=f.sessions.audio({id:session.id,audio:Buffer.alloc(5120).toString('base64')}).events;assert.equal(events.filter(e=>e.event==='EndOfTurn').length,2);assert.equal(f.socket.sent.length,1);assert.equal(f.sessions.sessions.size,1);f.sessions.close();
});
test('continuous client keeps microphone open, delivers barge-in before final text, and stops explicitly',async()=>{
 let index=0,starts=0;const f=captureFixture(async(url)=>url.endsWith('/audio')?Response.json({events:[{event:'StartOfTurn',turnIndex:index},{event:'EndOfTurn',turnIndex:index++,transcript:'Final turn'}]}):Response.json({id:'fixture'}));f.capture.onSpeechStart=()=>starts++;
 await f.capture.start({continuous:true});for(let i=0;i<2;i++){f.node.port.onmessage({data:new ArrayBuffer(5120)});await settle();}
 assert.equal(starts,2);assert.equal(f.turns.length,2);assert.equal(f.tracks[0].stops,0);f.capture.stop();assert.equal(f.tracks[0].stops,1);
});

test('Flux capture stops forwarding microphone frames during playback and resumes only its current session',async()=>{
 let frames=0;const f=captureFixture(async(url)=>{if(url.endsWith('/audio'))frames++;return Response.json({id:'fixture',events:[]});});
 await f.capture.start({continuous:true});f.capture.pause();assert.equal(f.tracks[0].enabled,false);f.node.port.onmessage({data:new ArrayBuffer(5120)});await settle();assert.equal(frames,0);
 f.capture.resume();assert.equal(f.tracks[0].enabled,true);f.node.port.onmessage({data:new ArrayBuffer(5120)});await settle();assert.equal(frames,1);
 f.capture.pause();f.capture.stop();f.capture.resume();assert.equal(f.tracks[0].enabled,false);assert.equal(f.tracks[0].stops,1);
});
test('Flux cannot replay a pre-acknowledgement final transcript after capture resumes',async()=>{
 let release;const held=new Promise(r=>release=r);const f=captureFixture(async url=>url.endsWith('/audio')?held:Response.json({id:'fixture'}));
 await f.capture.start({continuous:true});f.node.port.onmessage({data:new ArrayBuffer(5120)});await settle();f.capture.pause();f.capture.resume();
 release(Response.json({events:[{event:'EndOfTurn',transcript:'old chat',turnIndex:0}]}));await settle();assert.deepEqual(f.turns,[]);assert.deepEqual(f.transcripts,[]);f.capture.stop();
});
