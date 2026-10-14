import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../runtime/store.mjs';
import { Engine } from '../runtime/engine.mjs';
import { runDiagnostics } from '../runtime/diagnostics.mjs';
function fixture(t, env = {}) {
 const dir=mkdtempSync(join(tmpdir(),'apex-checks-')); const store=new Store(join(dir,'test.sqlite')); const engine=new Engine(store,{env}); engine.lastWorkerHeartbeat=Date.now();
 t.after(()=>{store.close();assert.ok(dir.startsWith(join(tmpdir(),'apex-checks-')));rmSync(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});});return {engine,store};
}
test('diagnostics records 18 scoped results including untested transports and cleans its write probe',async t=>{
 const {engine,store}=fixture(t);let calls=0;const report=await runDiagnostics(engine,{fetcher:()=>{calls++;throw new Error('must not call');}});
 assert.equal(report.checks.length,18);assert.equal(report.passed,10);assert.equal(report.checks.find(c=>c.id==='key').state,'failed');assert.equal(report.checks.find(c=>c.id==='provider').state,'skipped');assert.equal(calls,0);assert.equal(store.list('probe').length,0);assert.equal(engine.status().checks.id,report.id);
});

test('diagnostics publishes running and finished rows before final completion',async t=>{
 const {engine}=fixture(t);const events=[];
 const report=await runDiagnostics(engine,{fetcher:()=>{throw Error('No provider');},onUpdate:r=>events.push(JSON.parse(JSON.stringify(r)))});
 assert.equal(events[0].state,'running');assert.equal(events[0].checks.length,0);
 for(const c of report.checks){assert.ok(events.some(r=>r.checks.some(x=>x.id===c.id&&x.state==='running')));assert.ok(events.some(r=>r.checks.some(x=>x.id===c.id&&x.state===c.state)));}
 assert.equal(events.at(-1).state,'completed');assert.equal(engine.checking,false);
});
test('provider check verifies model metadata without exposing the key',async t=>{
 const {engine}=fixture(t,{GEMINI_API_KEY:'fixture-secret',GEMINI_MODEL:'fixture-model'});let headers;
 const report=await runDiagnostics(engine,{fetcher:async(url,options)=>{headers=options.headers;assert.match(url,/fixture-model$/);return {ok:true,json:async()=>({supportedGenerationMethods:['generateContent']})};}});
 assert.equal(report.passed,12);assert.equal(headers['x-goog-api-key'],'fixture-secret');assert.doesNotMatch(JSON.stringify(report),/fixture-secret/);assert.match(report.checks.find(c=>c.id==='provider').detail,/generation still needs/);assert.equal(report.checks.find(c=>c.id==='generation').state,'skipped');
});
test('concurrent diagnostics is rejected and failed provider remains visible',async t=>{
 const {engine}=fixture(t,{GEMINI_API_KEY:'fixture'});let release,started;const began=new Promise(r=>started=r);const held=new Promise(r=>release=r);
 const run=runDiagnostics(engine,{fetcher:async()=>{started();await held;return {ok:false,status:403};}});await began;
 await assert.rejects(runDiagnostics(engine),e=>e.status===409);release();const report=await run;
 assert.equal(report.checks.find(c=>c.id==='provider').state,'failed');assert.equal(report.passed,11);assert.equal(engine.checking,false);
});
