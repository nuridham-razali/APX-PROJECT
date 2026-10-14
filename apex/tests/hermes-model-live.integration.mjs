// Explicitly live, local-only validation. No Fish/Deepgram/paid model calls.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8093',token=readFileSync('.apex-data/hermes-validation/runtime-token','utf8').trim();
const modelToken=readFileSync('.apex-data/hermes-validation/hermes-model-token','utf8').trim();
const report={at:new Date().toISOString(),type:'LIVE local model and Hermes; no mocked handlers',checks:[]};
async function request(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'x-apex-token':token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(190000)});const result=await response.json();if(!response.ok)throw Error(result.error||`HTTP ${response.status}`);return result;}
try{
 const status=await request('/hermes/status');assert.equal(status.state,'idle',status.detail);assert.ok(status.tools.includes('web_search'));report.checks.push({name:'Hermes authenticated read-only profile and compatible context',passed:true});
 const started=Date.now();
 const response=await fetch(base+'/hermes/model/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${modelToken}`,'Content-Type':'application/json'},body:JSON.stringify({model:'qwen3.5:4b',messages:[{role:'user',content:'Reply with exactly: APEX LOCAL READY'}],max_tokens:32,stream:false}),signal:AbortSignal.timeout(185000)});
 const direct=await response.json();assert.ok(response.ok,'Local gateway generation failed');assert.match(direct.choices?.[0]?.message?.content||'',/APEX LOCAL READY/);
 const ps=await (await fetch('http://127.0.0.1:11434/api/ps')).json(),loaded=ps.models.find(m=>m.name==='qwen3.5:4b');assert.ok(loaded?.context_length>=64000,'Actual running context must be at least 64K');
 report.checks.push({name:'Actual local 64K model generation',passed:true,elapsedMs:Date.now()-started,context:loaded.context_length,memoryBytes:loaded.size});console.log(JSON.stringify(report.checks.at(-1)));
 const task=await request('/tasks',{mode:'agents',assistant:'APEX',agent:'researcher',message:'Use web_search to find the official Python download page on python.org. Then use web_extract to read that page. Answer in one short paragraph with its URL and what it offers. You must use both tools; do not answer only from model knowledge.',conversationId:'live-hermes-'+randomUUID()});
 const taskStart=Date.now();let state,current;
 while(Date.now()-taskStart<185000){state=await request('/state');current=state.tasks.find(t=>t.id===task.id);if(['completed','failed','awaiting_input','cancelled'].includes(current?.state))break;await delay(1000);}
 const receipts=state.nodeEvents.filter(e=>e.taskId===task.id&&e.provider==='hermes');
 report.checks.push({name:'Live Hermes web search and extraction',passed:current?.state==='completed',taskId:task.id,state:current?.state,elapsedMs:Date.now()-taskStart,result:current?.result,error:current?.error,tools:receipts.filter(e=>e.kind==='tool').map(e=>({tool:e.tool,state:e.state,result:e.result}))});
 assert.equal(current?.state,'completed',current?.error||'Hermes task did not complete');
 for(const tool of ['web_search','web_extract'])assert.ok(receipts.some(e=>e.tool===tool&&e.state==='completed'),`Missing actual ${tool} receipt`);
 assert.match(current.result,/python\.org/);report.passed=true;
}catch(error){report.passed=false;report.error=error.message;process.exitCode=1;}
finally{writeFileSync('.apex-data/hermes-model-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
