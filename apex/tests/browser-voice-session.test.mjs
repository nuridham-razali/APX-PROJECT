import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserVoiceSession,browserSpeechPrivacy,PRIVACY_NOTICE,VOICE_ERRORS} from '../lib/browser-voice-session.mjs';
function clock(){let now=0,id=0;const timers=new Map();return {schedule(fn,ms){const key=++id;timers.set(key,{fn,at:now+ms});return key;},cancel(key){timers.delete(key);},tick(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}};}
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function fixture({local=false,startThrows=false}={}){
 const instances=[],calls=[],states=[],time=clock();let active=true,resolveWork;
 class Recognition{constructor(){if(local)this.processLocally=false;instances.push(this);this.starts=0;this.aborts=0;}start(){this.starts++;if(startThrows)throw Error('Blocked');}abort(){this.aborts++;}static async available(){return local?'available':'unavailable';}}
 const controller=new BrowserVoiceSession({getConstructor:()=>Recognition,onChange:v=>states.push(v),submit:(text,signal)=>{calls.push({text,signal,recognitionPaused:instances.at(-1).aborts>0});return new Promise(resolve=>resolveWork=resolve);},active:()=>active,...time});
 return {controller,instances,calls,states,time,resolve:()=>resolveWork(),setActive:v=>active=v,result(text){const r=instances.at(-1);r.onresult({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:false})]});},async start(){await controller.enable();if(!local)controller.continueUnknown();assert.equal(controller.state,'IDLE');instances.at(-1).onstart();assert.equal(controller.state,'LISTENING');}};
}
test('recognition starts OFF and privacy detection never captures or requests microphone access',async()=>{
 let starts=0;class Unknown{start(){starts++;}}
 assert.equal((await browserSpeechPrivacy(null)).supported,false);
 assert.deepEqual(await browserSpeechPrivacy(Unknown),{supported:true,local:false,message:PRIVACY_NOTICE});assert.equal(starts,0);
 const f=fixture();assert.equal(f.controller.state,'OFF');assert.equal(f.instances.length,0);await f.controller.enable();assert.equal(f.controller.microphoneEnabled,false);assert.equal(f.controller.pendingConsent,true);assert.equal(f.instances.every(r=>r.starts===0),true);
 f.controller.off();f.controller.continueUnknown();assert.equal(f.controller.microphoneEnabled,false);
});
test('only browser-confirmed local recognition is forced on-device, and LISTENING requires onstart',async()=>{
 const f=fixture({local:true});await f.controller.enable();assert.equal(f.controller.privacy.local,true);assert.equal(f.instances.at(-1).processLocally,true);assert.equal(f.controller.state,'IDLE');f.instances.at(-1).onstart();assert.equal(f.controller.state,'LISTENING');f.controller.dispose();
});
test('interim and final results form one draft and inactivity submits exactly once',async()=>{
 const f=fixture();await f.start();f.result('What is the weather');f.time.tick(2000);assert.equal(f.calls.length,0);
 f.result('What is the weather today?');f.time.tick(2499);assert.equal(f.calls.length,0);f.time.tick(1);assert.equal(f.calls.length,1);assert.equal(f.calls[0].text,'What is the weather today?');assert.equal(f.calls[0].recognitionPaused,true);assert.equal(f.controller.state,'WAITING');f.time.tick(10000);assert.equal(f.calls.length,1);f.controller.dispose();
});
test('speech activity resets inactivity; empty input never reaches any backend',async()=>{
 const f=fixture();await f.start();f.result('   ');f.time.tick(10000);assert.equal(f.calls.length,0);
 f.result('Hello');f.time.tick(2000);f.instances.at(-1).onspeechstart();f.time.tick(5000);assert.equal(f.calls.length,0);f.instances.at(-1).onspeechend();f.time.tick(2499);assert.equal(f.calls.length,0);f.time.tick(1);assert.equal(f.calls.length,1);f.controller.dispose();
});
test('final transcript submits after inactivity even when the browser omits speechend',async()=>{
 const f=fixture();await f.start();const recognition=f.instances.at(-1);recognition.onspeechstart();
 recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:'Hey Apex, explain this'}],{isFinal:true})]});
 f.time.tick(2499);assert.equal(f.calls.length,0);f.time.tick(1);assert.equal(f.calls.length,1);assert.equal(f.calls[0].text,'explain this');
 f.resolve();await flush();f.instances.at(-1).onstart();assert.equal(f.controller.state,'LISTENING');f.controller.dispose();
});
test('new speech after a final segment cancels its send deadline until the next segment finishes',async()=>{
 const f=fixture();await f.start();const recognition=f.instances.at(-1);recognition.onspeechstart();
 recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:'First part'}],{isFinal:true})]});f.time.tick(2000);recognition.onspeechstart();
 f.time.tick(5000);assert.equal(f.calls.length,0);
 recognition.onresult({resultIndex:1,results:[Object.assign([{transcript:'First part'}],{isFinal:true}),Object.assign([{transcript:'second part'}],{isFinal:true})]});
 f.time.tick(2500);assert.equal(f.calls.length,1);assert.equal(f.calls[0].text,'First part second part');f.controller.dispose();
});
test('editing cancels automatic submission and SEND uses the edited draft',async()=>{
 const f=fixture();await f.start();f.result('Original');const stale=f.instances.at(-1).onresult;f.controller.edit('My corrected message');f.controller.resume();f.time.tick(10000);stale({results:[[{transcript:'stale'}]],resultIndex:0});assert.equal(f.calls.length,0);assert.equal(f.controller.draft,'My corrected message');void f.controller.send();assert.equal(f.calls[0].text,'My corrected message');f.controller.dispose();
});
test('CANCEL invalidates timers, result callbacks and old recognition ends',async()=>{
 const f=fixture();await f.start();f.result('Discard me');const old=f.instances.at(-1),result=old.onresult,end=old.onend;f.controller.cancelDraft();result({resultIndex:0,results:[[{transcript:'Discard me'}]]});end();f.time.tick(10000);assert.equal(f.calls.length,0);assert.equal(f.controller.draft,'');f.controller.dispose();
});
test('recognition stays paused through model and audio work, then resumes only after completion',async()=>{
 const f=fixture();await f.start();f.result('Ask once');f.time.tick(2500);const before=f.instances.length;f.controller.playing();assert.equal(f.controller.state,'SPEAKING');f.time.tick(60000);assert.equal(f.instances.length,before);f.resolve();await flush();assert.equal(f.controller.state,'IDLE');assert.equal(f.instances.length,before+1);f.instances.at(-1).onstart();assert.equal(f.controller.state,'LISTENING');f.controller.dispose();
});
test('STOP cancels pending work and old completions cannot disturb the resumed microphone',async()=>{
 const f=fixture();await f.start();f.result('Ask');f.time.tick(2500);f.controller.playing();f.controller.stop();assert.equal(f.calls[0].signal.aborted,true);f.instances.at(-1).onstart();const before=f.instances.length;f.resolve();await flush();assert.equal(f.controller.state,'LISTENING');assert.equal(f.instances.length,before);f.controller.dispose();
});
test('MIC OFF and disposal permanently invalidate asynchronous callbacks until explicit enable',async()=>{
 const f=fixture();await f.start();f.result('Ask');f.time.tick(2500);f.controller.off();const before=f.instances.length;f.resolve();await flush();f.time.tick(10000);assert.equal(f.controller.state,'OFF');assert.equal(f.instances.length,before);f.controller.resume();assert.equal(f.instances.length,before);f.controller.dispose();
});
test('unexpected recognition end does not submit and permits only one controlled restart',async()=>{
 const f=fixture();await f.start();f.result('Unfinished');f.instances.at(-1).onend();assert.equal(f.calls.length,0);f.time.tick(300);f.instances.at(-1).onstart();f.instances.at(-1).onend();assert.equal(f.controller.state,'PAUSED');const before=f.instances.length;f.time.tick(10000);assert.equal(f.instances.length,before);assert.equal(f.calls.length,0);f.controller.dispose();
});
test('hidden pages, blocked starts and recognition failures never pretend to listen',async()=>{
 const f=fixture();await f.start();f.setActive(false);f.instances.at(-1).onend();f.time.tick(10000);assert.equal(f.controller.state,'PAUSED');assert.equal(f.instances.filter(r=>r.starts).length,1);f.controller.dispose();
 const blocked=fixture({startThrows:true});await blocked.controller.enable();blocked.controller.continueUnknown();assert.equal(blocked.controller.state,'PAUSED');blocked.controller.dispose();
 const failed=fixture();await failed.start();failed.instances.at(-1).onerror({error:'not-allowed'});assert.equal(failed.controller.state,'ERROR');assert.equal(failed.controller.message,VOICE_ERRORS.recognition);const before=failed.instances.length;failed.time.tick(10000);assert.equal(failed.instances.length,before);failed.controller.dispose();
});
test('disabled hands-free does not auto-submit or auto-resume; AI and audio errors pause without retry',async()=>{
 const f=fixture();await f.start();f.controller.setHandsFree(false);f.result('Manual only');f.time.tick(10000);assert.equal(f.calls.length,0);void f.controller.send();f.resolve();await flush();assert.equal(f.controller.state,'IDLE');f.controller.dispose();
 for(const voiceStage of ['ai','audio']){const x=fixture();x.controller.submit=async()=>{throw Object.assign(new Error('Fixture failure'),{voiceStage});};await x.start();x.result('Fail');x.time.tick(2500);await flush();assert.equal(x.controller.state,'ERROR');assert.equal(x.controller.message,VOICE_ERRORS[voiceStage]);x.time.tick(10000);assert.equal(x.instances.filter(r=>r.starts).length,1);x.controller.dispose();}
});
test('calling Apex alone reveals wake activity but never submits a request',async()=>{
 const f=fixture();await f.start();f.result('Hey Apex.');assert.equal(f.controller.snapshot().wakeRevision,1);assert.equal(f.controller.snapshot().wakeWaiting,true);assert.equal(f.controller.draft,'');f.time.tick(10000);assert.equal(f.calls.length,0);assert.equal(f.controller.state,'LISTENING');
 f.result('Hey Apex, what time is it?');assert.equal(f.controller.snapshot().wakeRevision,1);f.time.tick(2500);assert.equal(f.calls.length,1);assert.equal(f.calls[0].text,'what time is it?');f.controller.dispose();
});
test('wake-only acknowledgement uses its own audio callback, never submit, and resumes after playback',async()=>{
 const f=fixture();let release,acknowledgements=0;const held=new Promise(r=>release=r);
 f.controller.onWake=async()=>{acknowledgements++;f.controller.playing();await held;};await f.start();
 f.result('Hey Apex');f.time.tick(2500);assert.equal(acknowledgements,1);assert.equal(f.calls.length,0);assert.equal(f.controller.state,'SPEAKING');
 release();await flush();f.instances.at(-1).onstart();assert.equal(f.controller.state,'LISTENING');
 f.result('Apex, what did we discuss?');f.time.tick(2500);assert.equal(f.calls[0].text,'what did we discuss?');assert.equal(acknowledgements,1);f.controller.dispose();
});
test('a request following the wake phrase supersedes acknowledgement and MIC OFF cancels wake audio',async()=>{
 const f=fixture();let acknowledgements=0,release;f.controller.onWake=async signal=>{acknowledgements++;await new Promise(r=>release=r);assert.equal(signal.aborted,true);};await f.start();
 f.result('Apex');f.time.tick(1000);f.result('Apex, explain this');f.time.tick(2500);assert.equal(f.calls.length,1);assert.equal(acknowledgements,0);
 f.resolve();await flush();f.instances.at(-1).onstart();f.result('Hey Apex');f.time.tick(2500);assert.equal(acknowledgements,1);
 f.controller.off();const starts=f.instances.length;release();await flush();assert.equal(f.controller.state,'OFF');assert.equal(f.instances.length,starts);f.controller.dispose();
});
test('wake and request in separate recognition results are combined, without dropping the request',async()=>{
 const f=fixture();await f.start();f.result('Apex');f.instances.at(-1).onresult({resultIndex:1,results:[[{transcript:'Apex'}],[{transcript:'Explain my options.'}]]});assert.equal(f.controller.draft,'Explain my options.');f.time.tick(2500);assert.equal(f.calls[0].text,'Explain my options.');f.controller.dispose();
});
test('microphone OFF rejects stale wake callbacks and keeps recognition disabled',async()=>{
 const f=fixture();await f.start();const stale=f.instances.at(-1).onresult;f.controller.off();stale({resultIndex:0,results:[[{transcript:'Hey Apex, do something'}]]});assert.equal(f.controller.snapshot().wakeRevision,0);assert.equal(f.controller.state,'OFF');assert.equal(f.calls.length,0);f.controller.dispose();
});
test('repeated wake-only utterances reveal again without becoming an AI request',async()=>{
 const f=fixture();await f.start();f.result('Hey Apex');f.time.tick(3000);f.instances.at(-1).onspeechstart();f.result('Hey Apex');f.instances.at(-1).onspeechend();f.time.tick(10000);assert.equal(f.controller.snapshot().wakeRevision,2);assert.equal(f.controller.draft,'');assert.equal(f.calls.length,0);f.controller.dispose();
});

test('a background announcement pauses only its playback and restores the enabled microphone',async()=>{
 const f=fixture();await f.start();let release;const held=new Promise(r=>release=r);const starts=f.instances.length;
 const notice=f.controller.announce(async()=>{assert.equal(f.instances.at(-1).aborts>0,true);f.controller.playing();await held;});
 assert.equal(f.controller.state,'SPEAKING');assert.equal(f.instances.length,starts);release();assert.equal(await notice,true);f.instances.at(-1).onstart();assert.equal(f.controller.state,'LISTENING');f.controller.dispose();
});
test('announcements defer unfinished speech and MIC OFF prevents a delayed announcement from resuming capture',async()=>{
 const f=fixture();await f.start();f.result('Unfinished question');let calls=0;assert.equal(await f.controller.announce(async()=>{calls++;}),false);assert.equal(calls,0);
 f.controller.cancelDraft();f.instances.at(-1).onstart();let release;const held=new Promise(r=>release=r);const notice=f.controller.announce(async()=>{await held;});f.controller.off();const starts=f.instances.length;release();await notice;assert.equal(f.controller.state,'OFF');assert.equal(f.instances.length,starts);f.controller.dispose();
});
