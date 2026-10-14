import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../runtime/store.mjs';
import {Engine} from '../runtime/engine.mjs';
import {dispatchTool,TOOL_REGISTRY,toolDeclarations} from '../runtime/tool-registry.mjs';
import {generate} from '../runtime/provider.mjs';
import {publicAddress,publicUrl,readPublic,parseSearch,searchPublic} from '../runtime/web-tools.mjs';
import {windowsAction} from '../runtime/system-tools.mjs';
const fixture=t=>{const store=new Store(':memory:');t.after(()=>store.close());return store;};
test('registered tools expose validated schemas; unknown names/fields cannot execute',async t=>{
 const e=new Engine(fixture(t),{env:{}});assert.ok(TOOL_REGISTRY.length>40);assert.equal(new Set(TOOL_REGISTRY.map(t=>t.name)).size,TOOL_REGISTRY.length);
 await assert.rejects(dispatchTool(e,'run_shell',{script:'anything'}),/Unregistered/);
 await assert.rejects(dispatchTool(e,'system_volume_set',{value:101}),/Invalid number/);
 await assert.rejects(dispatchTool(e,'file_write',{path:'test.txt',text:'x',approved:true}),/Unknown/);
});
test('approved file edits are exact, single-use, reversible and reject conflicting undo',async t=>{
 const root=await mkdtemp(join(tmpdir(),'apex-tools-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'note.txt'),'original');
 const e=new Engine(fixture(t),{env:{APEX_PROJECT_ROOT:root,APEX_DATA_DIR:join(root,'.apex-data')}});
 const p=await dispatchTool(e,'file_write',{path:'note.txt',text:'changed'},{conversationId:'test'});assert.equal(p.executed,false);assert.equal(await readFile(join(root,'note.txt'),'utf8'),'original');
 assert.throws(()=>e.approveNode({id:p.approval.id,summary:'different',confirm:true}),/exact/);
 const result=await e.approveNode({id:p.approval.id,summary:p.approval.summary,confirm:true});assert.equal(result.executed,true);assert.equal(await readFile(join(root,'note.txt'),'utf8'),'changed');
 assert.throws(()=>e.approveNode({id:p.approval.id,summary:p.approval.summary,confirm:true}),/already used/);
 const u=await dispatchTool(e,'action_undo',{id:result.result.undoId},{conversationId:'test'});await e.approveNode({id:u.approval.id,summary:u.approval.summary,confirm:true});assert.equal(await readFile(join(root,'note.txt'),'utf8'),'original');
 const r=await dispatchTool(e,'file_write',{path:'note.txt',text:'third'},{approved:true,conversationId:'test'});await writeFile(join(root,'note.txt'),'newer');await assert.rejects(dispatchTool(e,'action_undo',{id:r.undoId},{approved:true,conversationId:'test'}),/newer work/);
 for(const path of ['.env.local','../outside.txt','.voice-env/key.txt'])await assert.rejects(dispatchTool(e,'file_write',{path,text:'x'},{approved:true}),/authorised|escapes/);
});
test('Gemini tool turns preserve signatures and deliver final text only (mocked model)',async t=>{
 let count=0;const signature='opaque-signature';const e=new Engine(fixture(t),{env:{APEX_PROVIDER:'gemini'},generator:async(contents,ins,options)=>{
  count++;assert.ok(options.tools.some(t=>t.name==='analytics_read'));
  if(count===1)return {model:'mock',functionCalls:[{name:'analytics_read',args:{}}],content:{role:'model',parts:[{thoughtSignature:signature,functionCall:{name:'analytics_read',args:{}}}]}};
  assert.equal(contents.at(-2).parts[0].thoughtSignature,signature);assert.equal(contents.at(-1).parts[0].functionResponse.name,'analytics_read');return {text:'No recorded tasks yet.',model:'mock'};
 }});const emitted=[];const result=await e.chat({message:'What is my recorded completion rate?',conversationId:'tools'},{onText:x=>emitted.push(x)});
 assert.equal(result.message,'No recorded tasks yet.');assert.deepEqual(emitted,['No recorded tasks yet.']);assert.equal(count,2);assert.equal(e.store.list('node_event')[0].state,'completed');
});
test('model cannot approve its own settings change; no OS call occurs (mocked model)',async t=>{
 const e=new Engine(fixture(t),{env:{APEX_PROVIDER:'gemini'},generator:async()=>({functionCalls:[{name:'system_volume_set',args:{value:30}}],model:'mock'})});
 const r=await e.chat({message:'Set volume to thirty',conversationId:'approve'});assert.match(r.message,/confirmation/);assert.equal(e.store.list('approval')[0].state,'pending');assert.equal(e.store.list('node_event')[0].state,'queued');
});
test('repeated tool calls terminate instead of replaying actions (mocked model)',async t=>{
 const e=new Engine(fixture(t),{env:{APEX_PROVIDER:'gemini'},generator:async()=>({functionCalls:[{name:'analytics_read',args:{}}],model:'mock'})});await assert.rejects(e.chat({message:'What are my recorded metrics?',conversationId:'duplicate'}),/duplicate/);assert.equal(e.store.list('node_event').filter(e=>e.state==='working').length,1);
});
test('Gemini REST function declarations and responses retain selected model (mocked HTTP)',async()=>{
 let payload;const content={role:'model',parts:[{thoughtSignature:'signed',functionCall:{name:'analytics_read',args:{}}}]};const r=await generate([{role:'user',parts:[{text:'metrics'}]}],'rules',{env:{GEMINI_API_KEY:'test',GEMINI_MODEL:'chosen-model'},tools:toolDeclarations(),fetcher:async(url,options)=>{assert.match(url,/chosen-model:generateContent$/);payload=JSON.parse(options.body);return {ok:true,json:async()=>({candidates:[{content,finishReason:'STOP'}]})};}});
 assert.equal(r.content.parts[0].thoughtSignature,'signed');assert.equal(payload.tools[0].functionDeclarations.length,TOOL_REGISTRY.length);
 await assert.rejects(generate([],'',{env:{GEMINI_API_KEY:'test'},tools:toolDeclarations(),fetcher:async()=>({ok:true,json:async()=>({candidates:[{content,finishReason:'MAX_TOKENS'}]})})}),/incomplete/);
});
test('public web access blocks private addresses, credentials and DNS resolving internally',async()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);for(const url of ['http://example.com','https://user:pass@example.com','https://localhost','https://127.0.0.1'])assert.throws(()=>publicUrl(url));
 let requested=false;await assert.rejects(readPublic('https://example.com',{resolver:async()=>[{address:'10.0.0.1',family:4}],request:()=>{requested=true;}}),/Private/);assert.equal(requested,false);
});
test('public search fallback parses real source-shaped fixtures and reports failure honestly (mocked retrieval)',async()=>{
 const xml='<rss><item><title>Official page</title><link>https://example.com/info</link><description>Source excerpt</description></item></rss>';
 assert.equal(parseSearch(xml,'bing-rss')[0].url,'https://example.com/info');let n=0;
 const result=await searchPublic('test',{env:{},reader:async()=>({text:++n===1?'no results':xml,fetchedAt:'test'})});assert.equal(result.provider,'bing-rss');assert.equal(n,2);
 await assert.rejects(searchPublic('test',{env:{},reader:async()=>{throw Error('blocked');}}),/unavailable/);
});
test('Windows adapter uses fixed script, shell=false, bounded timeout and parsed receipts (mocked OS)',async()=>{
 let args,opts;const result=await windowsAction('volume_get',{}, {platform:'win32',runner:(_cmd,a,o,cb)=>{args=a;opts=o;cb(null,'{"percent":47}');}});assert.equal(result.percent,47);assert.equal(opts.shell,false);assert.equal(opts.timeout,15000);assert.ok(args.includes('-File'));
 await assert.rejects(windowsAction('volume_get',{}, {platform:'win32',runner:(_c,_a,_o,cb)=>cb(Error('failure'))}),/unavailable/);
});
test('live tool status lasts until actual settlement (mock browser)',async t=>{
 let settle;const e=new Engine(fixture(t),{env:{APEX_PROVIDER:'gemini',GEMINI_API_KEY:'mock'}});e.browserController={execute:()=>new Promise(r=>settle=r)};
 const pending=dispatchTool(e,'browser_tabs',{}, {conversationId:'live'});assert.equal(e.status().nodes.find(n=>n.id==='researcher').state,'working');settle({tabs:[]});await pending;assert.equal(e.status().nodes.find(n=>n.id==='researcher').state,'completed');assert.equal(e.activeTools.size,0);
});
test('browser approval binds to observed page and refuses a changed page (mock browser)',async t=>{
 const e=new Engine(fixture(t),{env:{}});let url='https://example.com/',executed=0;e.browserController={current:()=>({page:{url:()=>url}}),execute:()=>{executed++;return {clicked:true};}};
 const p=await dispatchTool(e,'browser_click',{role:'button',label:'Submit'},{conversationId:'page'});assert.match(p.approval.summary,/Observed page: https:\/\/example.com/);url='https://different.example/';await assert.rejects(e.approveNode({id:p.approval.id,summary:p.approval.summary,confirm:true}),/page changed/);assert.equal(executed,0);
});
