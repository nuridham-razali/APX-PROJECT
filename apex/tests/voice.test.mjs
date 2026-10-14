import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceController } from '../lib/voice-controller.mjs';
function setup(t) {
 t.mock.timers.enable({apis:['setTimeout','Date']}); let starts=0,aborts=0;const sent=[],states=[],errors=[];let utterance;
 const recognition={start(){starts++;this.onstart?.();},abort(){aborts++;this.onend?.();}};
 const synth={cancel(){utterance?.onerror?.({error:'canceled'});},getVoices(){return[];},speak(u){utterance=u;u.onstart();}};
 const c=new VoiceController({recognitionFactory:()=>recognition,synth,utteranceFactory:text=>({text}),onSend:x=>sent.push(x),onState:x=>states.push(x),onError:x=>errors.push(x)});
 t.after(()=>c.dispose());return {c,recognition,sent,states,errors,get starts(){return starts;},get aborts(){return aborts;},get utterance(){return utterance;}};
}
test('mic starts off, silence sends once, reply playback cannot become a new input',async t=>{
 const f=setup(t);assert.equal(f.c.enabled,false);assert.equal(f.starts,0);f.c.enable();f.recognition.onresult({results:[[{transcript:'Apex system check'}]]});t.mock.timers.tick(2499);assert.equal(f.sent.length,0);t.mock.timers.tick(1);assert.deepEqual(f.sent,['system check']);assert.equal(f.c.busy,true);assert.equal(f.c.active,false);
 const speaking=f.c.speak('10 of 12 checks passed.');assert.equal(f.c.active,false);f.recognition.onresult({results:[[{transcript:'echoed assistant speech'}]]});assert.equal(f.c.buffer,'');t.mock.timers.tick(3000);assert.equal(f.sent.length,1);f.utterance.onend();await speaking;f.c.endTurn();t.mock.timers.tick(750);assert.equal(f.c.active,true);
});
test('editing cancels automatic send and pauses until explicit resume',t=>{
 const f=setup(t);f.c.enable();f.recognition.onresult({results:[[{transcript:'draft'}]]});f.c.edit('edited draft');t.mock.timers.tick(5000);assert.equal(f.sent.length,0);assert.equal(f.c.paused,true);assert.equal(f.c.active,false);f.c.resume();assert.equal(f.c.active,true);
});
test('permission errors cancel silence send; speech errors return to idle',async t=>{
 const f=setup(t);f.c.enable();f.recognition.onresult({results:[[{transcript:'draft'}]]});f.recognition.onerror({error:'not-allowed'});t.mock.timers.tick(3000);assert.equal(f.sent.length,0);assert.equal(f.c.enabled,false);
 const speaking=f.c.speak('reply');f.utterance.onerror();await speaking;assert.equal(f.c.speaking,false);assert.equal(f.states.at(-1),'idle');assert.equal(f.errors.length,2);
});
test('stop speaking completes pending playback and never resumes while a turn is busy',async t=>{
 const f=setup(t);f.c.enable();f.c.beginTurn();const speaking=f.c.speak('pending reply');f.c.stopSpeaking();await speaking;t.mock.timers.tick(1000);assert.equal(f.c.active,false);f.c.endTurn();assert.equal(f.c.active,true);assert.deepEqual(f.errors,[]);
});
