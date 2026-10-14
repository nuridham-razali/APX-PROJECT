import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeCheckStream,diagnosticAnnouncement,isSystemCheckCommand} from '../lib/system-check.mjs';
import {checkPresentationStage,revealedCheckCount,checkOutcome} from '../lib/check-presentation.mjs';
test('successful badge requires completed nonempty all-passed report',()=>{assert.equal(checkOutcome({state:'running',checks:[{state:'passed'}]}),'pending');for(const checks of [[],[{state:'failed'}],[{state:'skipped'}],[{state:'running'}]])assert.equal(checkOutcome({state:'completed',checks}),'warning');assert.equal(checkOutcome({state:'completed',checks:[{state:'passed'}]}),'passed');});
test('presentation holds completion only after real diagnostics finish',()=>{
  assert.equal(checkPresentationStage(13,true),'shockwave');
  assert.equal(checkPresentationStage(16,false),'waiting');
  assert.equal(checkPresentationStage(21,true),'completed');
});
test('progressive checklist cannot invent rows beyond collected results',()=>{
  assert.equal(revealedCheckCount(3,12),0);
  assert.equal(revealedCheckCount(3.5,12),1);
  assert.equal(revealedCheckCount(10,4),4);
  assert.equal(revealedCheckCount(10,0),0);
});
test('system check commands bypass inference without matching unrelated text',()=>{
  for(const s of ['System check','APEX, system check.','please run a system check','check your system'])assert.equal(isSystemCheckCommand(s),true);
  for(const s of ['write a system check guide','what is a system check?','check my email',''])assert.equal(isSystemCheckCommand(s),false);
});
test('spoken diagnostic results count real states and name failures and skipped checks',()=>{
  const report={state:'completed',checks:[{label:'Database',state:'passed',detail:'Verified'},{label:'Ollama',state:'failed',detail:'Model unavailable'},{label:'Provider',state:'skipped',detail:'No credential'}]};
  const message=diagnosticAnnouncement(report);assert.match(message,/^System check complete, Idham\./);assert.match(message,/1 of 3 checks passed/);assert.match(message,/Ollama: Model unavailable/);assert.match(message,/1 check was skipped/);assert.match(message,/separate verification/);
  assert.throws(()=>diagnosticAnnouncement({...report,state:'running'}),/completed/);
});
test('diagnostic stream survives split frames and requires a completed report',async()=>{
  const frames=[{type:'report',report:{id:'test',state:'running',checks:[]}},{type:'report',report:{id:'test',state:'completed',checks:[{id:'runtime',state:'passed'}]}}];
  const bytes=new TextEncoder().encode(frames.map(f=>`data: ${JSON.stringify(f)}\r\n\r\n`).join(''));let i=0;const stream=new ReadableStream({pull(c){if(i===bytes.length)return c.close();c.enqueue(bytes.slice(i,i+7));i=Math.min(i+7,bytes.length);}});const reports=[];
  const final=await consumeCheckStream(new Response(stream),r=>reports.push(r));assert.equal(reports.length,2);assert.equal(final.state,'completed');
  await assert.rejects(consumeCheckStream(new Response('data: {"type":"report","report":{"state":"running","checks":[]}}\n\n'),()=>{}),/before.*completed/);
  await assert.rejects(consumeCheckStream(Response.json({error:'A system check is already running.'},{status:409}),()=>{}),/already running/);
});
