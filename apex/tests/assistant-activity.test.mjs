import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPhase,hasAssistantWork,assistantActivity} from '../lib/assistant-activity.mjs';
test('microphone/audio idle cannot clear a pending reply; playback still takes priority',()=>{
 assert.equal(requestPhase('idle',true),'thinking');
 assert.equal(requestPhase('speaking',true),'speaking');
 assert.equal(requestPhase('listening',true),'listening');
 assert.equal(requestPhase('idle',false),'idle');
});
test('background workload is tracked separately from foreground face activity',()=>{
 for(const state of ['queued','running','cancellation_requested'])assert.equal(hasAssistantWork({tasks:[{state,assistant:'APEX'}]}),true);
 for(const state of ['completed','failed','cancelled','awaiting_input'])assert.equal(hasAssistantWork({tasks:[{state,assistant:'APEX'}]}),false);
 assert.equal(hasAssistantWork({tasks:[{state:'running',assistant:'NOVA'}]}),false);
 assert.equal(hasAssistantWork({loops:[{state:'Running'}]}),true);
 for(const state of ['Scheduled','Waiting','Needs approval','Paused','Completed','Failed'])assert.equal(hasAssistantWork({loops:[{state}]}),false);
 assert.equal(hasAssistantWork({nodeEvents:[{state:'working'}]}),false);
});
test('background work does not force the conversational orb into thinking',()=>{
 assert.equal(assistantActivity('standby',true),'standby');
 assert.equal(assistantActivity('speaking',true),'speaking');
 assert.equal(assistantActivity('listening',true),'listening');
 assert.equal(assistantActivity('thinking',false),'thinking');
 assert.equal(assistantActivity('standby',false),'standby');
});

test('HUD pending request overrides an idle or stale listening callback until completion',()=>{assert.equal(assistantActivity('standby',false,true),'thinking');assert.equal(assistantActivity('listening',false,true),'thinking');assert.equal(assistantActivity('speaking',false,true),'speaking');assert.equal(assistantActivity('standby',false,false),'standby');});
