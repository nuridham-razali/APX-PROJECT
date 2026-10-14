// Optional browser verification proxy. Every API is mocked; no model/voice request can pass through.
// Start production UI on 3000, then: node tests/humanoid-ui-fixture.mjs
import http from 'node:http';
import {Engine} from '../runtime/engine.mjs';
import {Store} from '../runtime/store.mjs';
const backgroundFixture=process.env.APEX_FIXTURE_BACKGROUND==='1';
const fixtureStore=new Store(':memory:');
const fixtureEngine=new Engine(fixtureStore,{env:{APEX_PROVIDER:'ollama',OLLAMA_MODEL:'mock-no-api'},generator:async(contents,instruction,options)=>{
 if(options.format==='json')return {text:'{"opener":"Happy to help."}'};
 if(instruction.includes('Role: ')){await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,18000);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(options.signal.reason);},{once:true});});return {text:'Mock draft: APEX keeps foreground conversation separate from background work. No real model or external service was contacted.'};}
 return {text:'Mock conversational answer: four. The background task continues independently.'};
}});
import {NODE_REGISTRY} from '../lib/node-registry.mjs';
let tasks=[];const streams=new Set();
let failVoice=false;const ttsTexts=[],chatRequests=[];
const sampleRate=16000,samples=sampleRate*5,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i/sampleRate*2*Math.PI*220)*1200),44+i*2);
const state=()=>backgroundFixture?fixtureEngine.status():({configured:true,provider:'fixture',model:'mock-no-api',tasks,loops:[],activeTasks:tasks.filter(t=>t.state==='running').map(t=>t.id),nodes:NODE_REGISTRY.map(n=>({...n,state:'idle',connection:'Fixture only'})),agents:[],memory:[],workflows:[],loopNotifications:[]});
const emit=()=>{for(const r of streams)r.write('data: '+JSON.stringify(state())+'\n\n');};
setInterval(()=>{if(backgroundFixture)void fixtureEngine.tick();emit();},400);
const json=(r,data)=>{r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify(data));};
http.createServer(async(q,r)=>{
 const path=q.url.split('?')[0];
 if(path==='/fixture-browser-speech.js'){
  r.writeHead(200,{'Content-Type':'application/javascript'});r.end(`
   // Test-only browser API. Never enabled by the production application.
   let current=null,starts=0;class FixtureRecognition{
    constructor(){this.processLocally=false;}
    static async available(){return location.search.includes('browserSpeech=unknown')?'unavailable':'available';}
    start(){current=this;starts++;document.documentElement.setAttribute('data-fixture-mic-starts',String(starts));queueMicrotask(()=>{if(current===this)this.onstart?.();});}
    abort(){if(current===this)current=null;}
   }
   window.SpeechRecognition=FixtureRecognition;
   addEventListener('DOMContentLoaded',()=>{
    const controls=document.createElement('div');controls.style.cssText='position:fixed;right:10px;top:60px;z-index:999;color:white;background:#15202b;padding:8px;font:11px monospace';
    const label=document.createElement('div');label.textContent='MOCK BROWSER SPEECH / NO MICROPHONE';controls.append(label);
    const emit=document.createElement('button');emit.textContent='Fixture: speak weather';emit.onclick=()=>{if(!current)return;current.onspeechstart?.();current.onresult?.({resultIndex:0,results:[[{transcript:'What is the weather today?'}]]});current.onspeechend?.();};controls.append(emit);
    const final=document.createElement('button');final.textContent='Fixture: final without speechend';final.onclick=()=>{if(!current)return;current.onspeechstart?.();current.onresult?.({resultIndex:0,results:[Object.assign([{transcript:'Hey Apex, explain this'}],{isFinal:true})]});};controls.append(final);
    for(const [name,text] of [['Fixture: call Apex','Hey Apex'],['Fixture: Apex weather','Hey Apex, what is the weather today?'],['Fixture: start background task','Hey Apex, draft a background memo'],['Fixture: ask another question','Hey Apex, what is two plus two?'],['Fixture: ask task status','Hey Apex, is it ready?']]){const button=document.createElement('button');button.textContent=name;button.onclick=()=>{if(!current)return;current.onspeechstart?.();current.onresult?.({resultIndex:0,results:[[{transcript:text}]]});current.onspeechend?.();};controls.append(button);}
    const end=document.createElement('button');end.textContent='Fixture: recognition ends';end.onclick=()=>{const old=current;current=null;old?.onend?.();};controls.append(end);document.body.append(controls);
    const hide=document.createElement('button');hide.textContent='Hide fixture controls';hide.onclick=()=>{for(const button of controls.querySelectorAll('button'))button.hidden=true;};controls.append(hide);
    addEventListener('apex-browser-voice-state',event=>{if(event.detail.voice)label.textContent='MOCK / '+event.detail.voice.state+' / starts '+starts;});
   });
  `);return;
 }
 if(path==='/api/runtime/conversation'){let raw='';for await(const chunk of q)raw+=chunk;const body=JSON.parse(raw);return json(r,fixtureStore.get('conversation',body.conversationId)||{contents:[]});}
 if(path==='/api/runtime/task-notifications'){let raw='';for await(const chunk of q)raw+=chunk;try{return json(r,fixtureEngine.claimTaskNotice(JSON.parse(raw)));}catch(error){r.writeHead(error.status||400,{'Content-Type':'application/json'});return r.end(JSON.stringify({error:error.message}));}}
 if(path==='/api/fixture/background')return json(r,{tasks:fixtureStore.list('task'),notices:fixtureStore.list('task_notice'),conversations:fixtureStore.list('conversation'),tts:ttsTexts});
 if(path==='/api/runtime/state')return json(r,state());
 if(path==='/api/runtime/events'){r.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});streams.add(r);r.write('data: '+JSON.stringify(state())+'\n\n');q.on('close',()=>streams.delete(r));return;}
 if(path==='/api/runtime/voice/status')return json(r,{apex:{ready:false,speechReady:true}});
 if(path==='/api/fixture/tts')return json(r,{texts:ttsTexts});
 if(path==='/api/fixture/requests')return json(r,{messages:chatRequests});
 if(path==='/api/runtime/voice/speak'){
  let raw='';for await(const chunk of q)raw+=chunk;const body=JSON.parse(raw);ttsTexts.push(body.text);
  if(failVoice){r.writeHead(503,{'Content-Type':'application/json'});r.end(JSON.stringify({error:'Mock-only speech service unavailable'}));return;}
  await new Promise(resolve=>setTimeout(resolve,1800));return json(r,{audio:wav.toString('base64'),mime:'audio/wav'});
 }
 if(path==='/api/runtime/chat/stream'){
  let raw='';for await(const chunk of q)raw+=chunk;const body=JSON.parse(raw),message=body.message||'';chatRequests.push(message);if(backgroundFixture){r.writeHead(200,{'Content-Type':'application/x-ndjson'});try{const reply=await fixtureEngine.chat(body);r.end(JSON.stringify({type:'done',reply})+'\n');}catch(error){r.end(JSON.stringify({type:'error',error:error.message})+'\n');}return;}failVoice=/failure/i.test(message);r.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store'});
  r.write(JSON.stringify({type:'delta',text:'This is a simulated first sentence. '})+'\n');
  await new Promise(resolve=>setTimeout(resolve,1500));
  r.write(JSON.stringify({type:'delta',text:'The full text survives a speech-service failure.'})+'\n');
  r.end(JSON.stringify({type:'done',reply:{message:'# Answer\n**This is a simulated first sentence.** The full text survives a speech-service failure.'}})+'\n');return;
 }
 if(path==='/api/runtime/chat'){
  let body='';for await(const chunk of q)body+=chunk;
  if(body.includes('reproduce failure')){r.writeHead(502,{'Content-Type':'application/json'});r.end(JSON.stringify({error:'Mock-only Gemini HTTP 429: fixture quota failure'}));return;}
  await new Promise(resolve=>setTimeout(resolve,15000));
  tasks=[{id:'mock-humanoid-task',assistant:'APEX',state:'running',request:'Mock background verification',progress:'Fixture running',steps:[],result:'',error:''}];emit();
  json(r,{message:'Mock reply received. A fixture background task is still running. No Gemini or Fish calls were made.',taskId:'mock-humanoid-task'});
  setTimeout(()=>{tasks=tasks.map(t=>({...t,state:'completed',result:'Fixture completed'}));emit();},15000);return;
 }
 if(path.startsWith('/api/')){r.writeHead(503,{'Content-Type':'application/json'});r.end(JSON.stringify({error:'API blocked by browser fixture'}));return;}
 const target=http.request({hostname:'127.0.0.1',port:3000,path:q.url,method:q.method,headers:{...q.headers,host:'127.0.0.1:3000','accept-encoding':'identity'}},source=>{
  if(q.url.includes('browserSpeech=')&&String(source.headers['content-type']).includes('text/html')){let html='';source.setEncoding('utf8');source.on('data',chunk=>html+=chunk);source.on('end',()=>{const headers={...source.headers};delete headers['content-length'];r.writeHead(source.statusCode,headers);r.end(html.replace('<head>','<head><script src="/fixture-browser-speech.js"></script>'));});}
  else {r.writeHead(source.statusCode,source.headers);source.pipe(r);}
 });target.on('error',()=>{r.writeHead(502);r.end('Start production UI on port 3000 first.');});q.pipe(target);
}).listen(8089,'127.0.0.1',()=>console.log('Mock-only humanoid verification: http://127.0.0.1:8089'));
