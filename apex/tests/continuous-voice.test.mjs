import test from 'node:test';
import assert from 'node:assert/strict';
import {ContinuousVoice,SpeechGate} from '../lib/continuous-voice.mjs';
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
function fixture(overrides={}){
  const captures=[],changes=[];let stopped=0,outputs=0,cancelled=0,transcribes=0,responses=0;
  const adapters={capture:async callbacks=>{captures.push(callbacks);return true;},stopCapture:()=>{stopped++;},stopOutput:()=>{outputs++;},cancelTurn:()=>{cancelled++;},transcribe:async()=>{transcribes++;return 'Hello NOVA';},respond:async()=>{responses++;return true;},onChange:value=>changes.push(value),...overrides};
  return{loop:new ContinuousVoice(adapters),captures,changes,counts:()=>({stopped,outputs,cancelled,transcribes,responses})};
}
test('silence and isolated clicks cannot submit a request; sustained speech finishes once after a pause',()=>{
  const quiet=new SpeechGate();for(let t=0;t<30000;t+=50)assert.equal(quiet.sample(.004,t),false);
  const clicks=new SpeechGate();for(let t=0;t<10000;t+=50)assert.equal(clicks.sample(t%1000===0?.2:.003,t),false);
  const gate=new SpeechGate();for(let t=0;t<800;t+=50)assert.equal(gate.sample(.05,t),false);
  assert.equal(gate.hasSpeech,true);
  for(let t=800;t<1850;t+=50)assert.equal(gate.sample(.002,t),false);
  assert.equal(gate.sample(.002,1850),true);assert.equal(gate.sample(.002,3000),false);
});
test('conversation is opt-in and waits for complete playback plus cooldown before listening again',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const playback=deferred();const f=fixture({respond:async()=>playback.promise});
  assert.equal(f.captures.length,0);await f.loop.start();assert.equal(f.captures.length,1);
  f.captures[0].onUtterance('speech');await settle();
  assert.equal(f.changes.at(-1).status,'responding');assert.equal(f.captures.length,1);
  t.mock.timers.tick(5000);assert.equal(f.captures.length,1);
  playback.resolve(true);await settle();assert.equal(f.changes.at(-1).status,'resuming');
  t.mock.timers.tick(599);assert.equal(f.captures.length,1);
  t.mock.timers.tick(1);await settle();assert.equal(f.captures.length,2);assert.equal(f.changes.at(-1).status,'listening');
  f.loop.stop();
});
test('silent capture rotates locally without transcription or model calls; stale callbacks cannot start turns',async()=>{
  const f=fixture();await f.loop.start();const old=f.captures[0];old.onUtterance('idle');await settle();
  assert.equal(f.captures.length,2);assert.equal(f.counts().transcribes,0);assert.equal(f.counts().responses,0);
  old.onUtterance('speech');old.onError('stale error');await settle();assert.equal(f.counts().transcribes,0);assert.equal(f.loop.enabled,true);
  f.loop.stop();
});
test('duplicate endpoint signals produce one turn; Stop cancels pending recognition and prevents restart',async()=>{
  const recognition=deferred();let requests=0;const f=fixture({transcribe:()=>{requests++;return recognition.promise;}});
  await f.loop.start();f.captures[0].onUtterance('speech');f.captures[0].onUtterance('speech');assert.equal(requests,1);
  f.loop.stop();recognition.resolve('Old words');await settle();assert.equal(f.counts().responses,0);assert.equal(f.captures.length,1);assert.equal(f.loop.enabled,false);
});
test('permission, empty speech, and response failures pause instead of repeating requests',async()=>{
  for(const override of [{capture:async()=>false},{transcribe:async()=>''},{respond:async()=>false}]){
    const f=fixture(override);await f.loop.start();if(f.loop.enabled)f.captures[0].onUtterance('speech');await settle();
    assert.equal(f.loop.enabled,false);assert.equal(f.changes.at(-1).status,'paused');assert.ok(f.changes.at(-1).error);
  }
});
test('Stop during reply aborts output and cannot reopen microphone when the reply finishes',async()=>{
  const reply=deferred();const f=fixture({respond:()=>reply.promise});await f.loop.start();f.captures[0].onUtterance('speech');await settle();
  f.loop.stop();reply.resolve(true);await settle();assert.equal(f.captures.length,1);assert.equal(f.loop.enabled,false);assert.equal(f.counts().outputs,1);assert.equal(f.counts().cancelled,1);
});
test('spoken stop command ends listening locally without a model or voice request',async()=>{
  const f=fixture({transcribe:async()=> 'Nova, stop listening.'});await f.loop.start();f.captures[0].onUtterance('speech');await settle();
  assert.equal(f.loop.enabled,false);assert.equal(f.counts().responses,0);assert.equal(f.changes.at(-1).status,'off');
});

test('task announcements wait for a quiet boundary, supersede obsolete progress, and resume only after playback',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const playback=deferred(),spoken=[];
  const f=fixture({announce:async words=>{spoken.push(words);return playback.promise;}});
  await f.loop.start();
  f.loop.queueAnnouncement('task-one','Going through it');
  f.loop.queueAnnouncement('task-one','Your task is ready');
  assert.equal(spoken.length,0);
  f.captures[0].onQuiet();await settle();assert.deepEqual(spoken,['Your task is ready']);assert.equal(f.changes.at(-1).status,'announcing');
  f.captures[0].onUtterance('speech');assert.equal(f.counts().transcribes,0);
  playback.resolve(true);await settle();t.mock.timers.tick(600);await settle();assert.equal(f.captures.length,2);
  f.captures[0].onQuiet();await settle();assert.equal(spoken.length,1);f.loop.stop();
});
test('a task update does not interrupt recognition or a reply, and Stop cancels pending announcement playback',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const recognition=deferred(),playback=deferred(),spoken=[];
  const f=fixture({transcribe:()=>recognition.promise,announce:async words=>{spoken.push(words);return playback.promise;}});
  await f.loop.start();f.captures[0].onUtterance('speech');
  f.loop.queueAnnouncement('task-two','Going through it');f.captures[0].onQuiet();await settle();assert.equal(spoken.length,0);
  recognition.resolve('Another task');await settle();t.mock.timers.tick(600);await settle();assert.equal(spoken.length,1);
  f.loop.stop();playback.resolve(true);await settle();t.mock.timers.tick(5000);await settle();assert.equal(f.captures.length,1);assert.equal(f.loop.enabled,false);
});
