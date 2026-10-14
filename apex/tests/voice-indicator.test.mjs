import test from 'node:test';
import assert from 'node:assert/strict';
import {extractApexWake} from '../lib/wake-phrase.mjs';
import {indicatorState,VoiceIndicatorVisibility} from '../lib/voice-indicator.mjs';
test('wake matching removes only a leading Apex address and preserves everything else',()=>{
 for(const text of ['Apex','APEX!','Hey Apex.','Hey, Apex'])assert.deepEqual(extractApexWake(text),{called:true,message:''});
 assert.deepEqual(extractApexWake('Hey Apex, explain Apex architecture.'),{called:true,message:'explain Apex architecture.'});
 for(const text of ['What is Apex?','Apexium is a name',"Apex's settings",'"Apex, delete this"'])assert.deepEqual(extractApexWake(text),{called:false,message:text});
});
test('wake matching tolerates common Flux phonetic aliases without matching embedded words',()=>{
 for(const text of ['pets','hey pets','hit next','eight','a pex'])assert.equal(extractApexWake(text).called,true,text);
 assert.equal(extractApexWake('pets what is the weather').message,'what is the weather');
 assert.equal(extractApexWake('the pets are outside').called,false);
});
test('indicator labels require real recognition and playback states',()=>{
 assert.equal(indicatorState('browser',{microphoneEnabled:false,state:'OFF'},'speaking'),'OFF');
 assert.equal(indicatorState('browser',{microphoneEnabled:true,state:'IDLE'},'standby'),'PAUSED');
 assert.equal(indicatorState('browser',{microphoneEnabled:true,state:'LISTENING'},'listening'),'LISTENING');
 assert.equal(indicatorState('browser',{microphoneEnabled:true,state:'WAITING'},'thinking'),'THINKING');
 assert.equal(indicatorState('browser',{microphoneEnabled:true,state:'SPEAKING'},'thinking'),'THINKING');
 assert.equal(indicatorState('browser',{microphoneEnabled:true,state:'SPEAKING'},'speaking'),'SPEAKING');
 assert.equal(indicatorState('deepgram',{},'listening'),'LISTENING');assert.equal(indicatorState('deepgram',{},'standby',true),'IDLE');assert.equal(indicatorState('deepgram',{},'standby',false),'OFF');
});
test('indicator stays visible through an interaction and new wake cancels the pending fade',()=>{
 const pending=new Map();let id=0,stage;const visibility=new VoiceIndicatorVisibility(value=>stage=value,{schedule:(fn,ms)=>{pending.set(++id,{fn,ms});return id;},cancel:key=>pending.delete(key)});
 visibility.reveal();assert.equal(stage,'visible');assert.equal(pending.size,0);visibility.finish();assert.equal([...pending.values()][0].ms,2400);
 visibility.reveal();assert.equal(pending.size,0);assert.equal(stage,'visible');visibility.finish();const hold=[...pending.values()][0];pending.clear();hold.fn();assert.equal(stage,'fading');const fade=[...pending.values()][0];pending.clear();fade.fn();assert.equal(stage,'hidden');
 visibility.reveal();visibility.finish();visibility.hide();assert.equal(pending.size,0);assert.equal(stage,'hidden');visibility.dispose();
});
