// Explicit live local-only validation: real Ollama, OS, SQLite and Hermes web tools.
// No speech calls, Google calls without credentials, external writes or deployments.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Engine} from '../runtime/engine.mjs';
import {Store} from '../runtime/store.mjs';
import {generate,brainConfig} from '../runtime/provider.mjs';
import {NODE_REGISTRY,NODE_EXAMPLES} from '../lib/node-registry.mjs';
import {readFileSync} from 'node:fs';
if(process.argv[2]==='--verify-report'){
 const reportPath=resolve(process.argv[3]),saved=JSON.parse(readFileSync(reportPath,'utf8')),database=new Store(join(reportPath,'..','apex.sqlite'));
 try{if(saved.results.length!==18)throw Error('Incomplete live report');for(const entry of saved.results){const request=NODE_EXAMPLES[entry.node].message+' Answer in at most 40 words; report actual limitations.';const task=database.list('task').find(t=>t.request===request&&t.steps.some(s=>s.agent===entry.node));if(!task||task.state!==entry.state||task.result!==entry.result)throw Error('Saved result differs from real execution record');if(entry.passed&&!database.list('node_event').some(e=>e.taskId===task.id&&e.node===entry.node&&e.state==='completed'))throw Error('Missing actual completion receipt');if(!entry.passed&&!entry.blocked)throw Error('Live handler failed');}console.log(JSON.stringify({completed:saved.results.filter(r=>r.passed).length,blocked:saved.results.filter(r=>r.blocked).map(r=>r.node),verification:'Saved live results match persistent tasks and actual completion receipts'}));}finally{database.close();}process.exit(0);
}
process.loadEnvFile('.env.local');
if(brainConfig(process.env).provider!=='ollama')throw Error('Paid model validation blocked. Select local Ollama.');
const directory=resolve('.apex-data/node-validation',randomUUID());mkdirSync(directory,{recursive:true});
const store=new Store(join(directory,'apex.sqlite'));
const engine=new Engine(store,{env:{...process.env,APEX_PROJECT_ROOT:process.cwd(),APEX_DATA_DIR:directory},generator:(contents,instruction,options)=>generate(contents,instruction,{...options,maxTokens:256})});
const report={at:new Date().toISOString(),model:brainConfig(process.env).model,type:'LIVE local inference/tools; Google account integrations not connected',results:[]};
try{
 for(const node of NODE_REGISTRY){
  const example=NODE_EXAMPLES[node.id],started=Date.now();
  const task=engine.nodeTask({agent:node.id,message:example.message+' Answer in at most 40 words; report actual limitations.',toolInput:example.input||{}});
  await engine.tick();const result=store.get('task',task.id),events=store.list('node_event').filter(e=>e.taskId===task.id);
  const blocked=['email','calendar','drive'].includes(node.id)&&result.state==='awaiting_input'&&/Not configured/.test(result.error);
  const entry={node:node.id,name:node.name,state:result.state,passed:result.state==='completed'&&Boolean(result.result)&&events.some(e=>e.node===node.id&&e.state==='completed'),blocked,elapsedMs:Date.now()-started,result:result.result,error:result.error,tools:events.filter(e=>e.kind==='tool').map(e=>({tool:e.tool,state:e.state}))};
  report.results.push(entry);console.log(JSON.stringify({node:node.id,state:entry.state,passed:entry.passed,blocked,elapsedMs:entry.elapsedMs}));writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2));
 }
 report.passed=report.results.every(r=>r.passed||r.blocked);report.fullyConnected=report.results.every(r=>r.passed);
 if(!report.passed)process.exitCode=1;
}finally{writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2));await engine.stop();await engine.loops.stop();store.close();console.log('Private validation report: '+join(directory,'report.json'));}
