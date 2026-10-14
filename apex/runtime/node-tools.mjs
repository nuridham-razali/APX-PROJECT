import {cpus,freemem,totalmem,platform,networkInterfaces} from 'node:os';
import {readFile,readdir,realpath,stat,statfs,mkdir,writeFile,cp} from 'node:fs/promises';
import {resolve,relative,join,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
import {getNode} from '../lib/node-registry.mjs';
import {googleConfigured,googleRead,gmailSend} from './google-tools.mjs';
import {searchPublic} from './web-tools.mjs';
export class Unavailable extends Error {constructor(message){super(message);this.unavailable=true;}}
export const integrationConfigured=(id,env)=>id==='drive'||(['email','calendar'].includes(id)&&env.APEX_INTEGRATION_PROVIDER==='google')?googleConfigured(env):Boolean(env.APEX_GRAPH_ACCESS_TOKEN);
export const toolStatus=(id,env)=>['email','calendar','drive'].includes(id)?(integrationConfigured(id,env)?'Configured; permission checked on use':'Not configured'):id==='researcher'?(env.BRAVE_SEARCH_API_KEY||env.APEX_FREE_WEB_SEARCH==='true'?'Live search enabled; verified on use':env.APEX_ORCHESTRATOR==='hermes'?'Hermes research; live connection checked on use':'Supplied/local sources; live search not configured'):'Local handler available';
const forbidden=/(^|[\\/])(?:\.env[^\\/]*|\.apex-data|\.git|\.vercel|\.aws|\.codex|node_modules|\.next|\.voice-env|secrets?|credentials?)([\\/]|$)|(?:runtime-token|\.sqlite|\.pem|\.key)$/i;
export async function projectFile(root,path){
 if(typeof path!=='string'||!path||isAbsolute(path)||path.includes('\0')||forbidden.test(path))throw new Error('File is outside authorised project sources.');
 const base=await realpath(root),file=await realpath(resolve(base,path)),rel=relative(base,file);
 if(rel.startsWith('..')||isAbsolute(rel)||forbidden.test(rel))throw new Error('File is outside authorised project sources.');
 const info=await stat(file);if(!info.isFile()||info.size>200000)throw new Error('Only project text files up to 200 KB can be read.');
 if(!/\.(?:tsx?|jsx?|mjs|cjs|json|css|md|txt|py|html)$/i.test(file))throw new Error('Unsupported source file type.');
 return {path:rel.replaceAll('\\','/'),text:await readFile(file,'utf8')};
}
export async function projectList(root){const found=[];async function walk(dir,depth=0){if(depth>3||found.length>=120)return;for(const f of await readdir(dir,{withFileTypes:true})){const rel=relative(root,join(dir,f.name));if(forbidden.test(rel)||f.isSymbolicLink())continue;if(f.isDirectory())await walk(join(dir,f.name),depth+1);else if(/\.(?:tsx?|jsx?|mjs|json|md|css|py)$/i.test(f.name))found.push(rel.replaceAll('\\','/'));if(found.length>=120)break;}}await walk(root);return found;}
export function executionMetrics(store){
 const tasks=store.list('task'),turns=store.list('metric'),completed=tasks.filter(t=>t.state==='completed'),durations=completed.filter(t=>t.startedAt&&t.completedAt).map(t=>Date.parse(t.completedAt)-Date.parse(t.startedAt)).filter(n=>Number.isFinite(n)&&n>=0);
 return {tasks:tasks.length,completed:completed.length,failed:tasks.filter(t=>t.state==='failed').length,blocked:tasks.filter(t=>['awaiting_input','awaiting_approval'].includes(t.state)).length,completionRate:tasks.length?completed.length/tasks.length:null,meanTaskMs:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,timedTasks:durations.length,meanChatMs:turns.length?turns.reduce((a,b)=>a+b.elapsedMs,0)/turns.length:null,timedChatTurns:turns.length,coverage:'Only recorded local tasks/turns; no external channel analytics.',recentFailures:tasks.filter(t=>t.state==='failed').slice(0,5).map(t=>({id:t.id,error:t.error}))};
}
export function financeCalculate(input){
 if(!Array.isArray(input)||!input.length||input.length>200)throw new Error('Supply 1–200 line items with a numeric amount and type income or expense.');
 let income=0,expense=0;for(const item of input){if(!item||!['income','expense'].includes(item.type)||typeof item.amount!=='number'||!Number.isFinite(item.amount)||Math.abs(item.amount)>1e12)throw new Error('Every amount must be a finite number with income/expense type.');if(item.type==='income')income+=item.amount;else expense+=item.amount;}
 const round=n=>Math.round(n*100)/100;return {income:round(income),expense:round(expense),net:round(income-expense),items:input.length,assumption:'All amounts must use the same supplied currency; no currency conversion.'};
}
export async function inspectSystem(root){
 const cpu=cpus(),before=cpu.map(c=>c.times);await new Promise(r=>setTimeout(r,120));const after=cpus();let idle=0,total=0;before.forEach((a,i)=>{const b=after[i]?.times;if(!b)return;idle+=b.idle-a.idle;for(const k of Object.keys(a))total+=b[k]-a[k];});
 let disk;try{const d=await statfs(root);disk={availableBytes:d.bavail*d.bsize,totalBytes:d.blocks*d.bsize};}catch{disk={unavailable:'Filesystem capacity unavailable on this platform'};}
 return {platform:platform(),cpu:{logicalCores:cpu.length,utilizationPercent:total?Math.round((1-idle/total)*100):null,sampleMs:120},ram:{totalBytes:totalmem(),freeBytes:freemem()},disk,network:{interfaces:Object.entries(networkInterfaces()).map(([name,rows])=>({name,addresses:rows?.filter(r=>!r.internal).map(r=>({family:r.family,address:r.address}))}))},runtime:{uptimeSeconds:process.uptime(),node:process.versions.node},limitations:'No temperature/GPU sensors, DNS trace, service restart or Windows settings changes are connected.'};
}
async function requestJson(url,key,signal,fetcher=fetch){
 let response;try{response=await fetcher(url,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),redirect:'error'});}catch{throw new Error('Connected service request failed or timed out.');}
 if(!response.ok)throw new Error(`Connected service returned HTTP ${response.status}. Check token expiry and required permissions.`);
 return response.json();
}
export async function connectedRead(id,env,signal,fetcher=fetch,input={}){
 if(id==='drive'||env.APEX_INTEGRATION_PROVIDER==='google')return googleRead(id,env,signal,fetcher,input);
 if(['email','calendar'].includes(id)){
  if(!env.APEX_GRAPH_ACCESS_TOKEN)throw new Unavailable('Not configured: add a Microsoft Graph delegated access token with Mail.Read or Calendars.Read on the backend.');
  const path=id==='email'?'messages?$top=20&$select=id,subject,from,receivedDateTime,bodyPreview':'calendarView?'+new URLSearchParams({startDateTime:new Date().toISOString(),endDateTime:new Date(Date.now()+7*86400000).toISOString(),$top:'30',$select:'id,subject,start,end,attendees'});
  const data=await requestJson('https://graph.microsoft.com/v1.0/me/'+path,env.APEX_GRAPH_ACCESS_TOKEN,signal,fetcher);return {service:'Microsoft Graph',records:data.value||[],truncated:Boolean(data['@odata.nextLink']),scope:id==='email'?'Latest 20 messages':'Upcoming 7 days, maximum 30 events'};
 }
 if(id==='drive'){
  if(!env.APEX_GOOGLE_ACCESS_TOKEN)throw new Unavailable('Not configured: add a Google Drive OAuth access token with drive.metadata.readonly on the backend.');
  const data=await requestJson('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({pageSize:'30',q:'trashed = false',fields:'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)'}),env.APEX_GOOGLE_ACCESS_TOKEN,signal,fetcher);return {service:'Google Drive',records:data.files||[],truncated:Boolean(data.nextPageToken),scope:'Metadata only; document content, sharing and deletion are not connected.'};
 }
 throw new Unavailable('Integration handler unavailable.');
}
export async function sendEmail(input,env,signal,fetcher=fetch){
 if(env.APEX_INTEGRATION_PROVIDER==='google')return gmailSend(input,env,signal,fetcher);
 if(!env.APEX_GRAPH_ACCESS_TOKEN)throw new Unavailable('Email sending is Not configured.');
 if(typeof input.to!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)||typeof input.subject!=='string'||typeof input.text!=='string')throw new Error('Supply one verified recipient, subject and message.');
 let response;try{response=await fetcher('https://graph.microsoft.com/v1.0/me/sendMail',{method:'POST',headers:{Authorization:`Bearer ${env.APEX_GRAPH_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({message:{subject:input.subject,body:{contentType:'Text',content:input.text},toRecipients:[{emailAddress:{address:input.to}}]},saveToSentItems:true}),signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),redirect:'error'});}catch{throw new Error('Email request failed or timed out. Delivery is unknown; do not retry automatically.');}
 if(response.status!==202)throw new Error(`Email request returned HTTP ${response.status}; no delivery claim.`);
 return {service:'Microsoft Graph',accepted:true,delivered:false,status:202,recipient:input.to,notice:'Provider accepted the sending request. Delivery is not independently verified.'};
}
export async function webSearch(query,env,signal,fetcher=fetch){
 if(env.APEX_FREE_WEB_SEARCH==='true')return searchPublic(query,{env,signal,fetcher});
 if(!env.BRAVE_SEARCH_API_KEY)return {available:false,notice:'Live web search is not configured. Cite supplied/local sources only.'};
 let response;try{response=await fetcher('https://api.search.brave.com/res/v1/web/search?'+new URLSearchParams({q:query.slice(0,600),count:'6'}),{headers:{'X-Subscription-Token':env.BRAVE_SEARCH_API_KEY},signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});}catch{throw new Error('Web search failed or timed out.');}
 if(!response.ok)throw new Error(`Web search returned HTTP ${response.status}.`);const data=await response.json();return {available:true,sources:(data.web?.results||[]).map(r=>({title:r.title,url:r.url,excerpt:r.description}))};
}
export async function preparePatch(root,dataDir,taskId,patches){
 if(!Array.isArray(patches)||!patches.length||patches.length>8)throw new Error('Supply 1–8 patch files.');
 const files=[];for(const patch of patches){const original=await projectFile(root,patch.path);if(typeof patch.content!=='string'||patch.content.length>200000)throw new Error('Invalid patch content.');files.push({path:original.path,original:original.text,proposed:patch.content});}
 const directory=join(dataDir,'developer',taskId);await mkdir(directory,{recursive:true});await writeFile(join(directory,'patch.json'),JSON.stringify({taskId,files},null,2));return {artifact:`developer/${taskId}/patch.json`,files:files.map(f=>f.path),applied:false,receipt:'Prepared isolated patch artifact; original project files unchanged.'};
}
export async function isolatedTests(root,dataDir,taskId,signal){
 const directory=join(dataDir,'developer',taskId,'test-workspace');await mkdir(directory,{recursive:true});
 for(const name of ['runtime','lib','tests','components','public'])await cp(join(root,name),join(directory,name),{recursive:true,filter:path=>!forbidden.test(relative(root,path))});
 await mkdir(join(directory,'docs'),{recursive:true});
 for(const name of ['ReasoningWeb.reference.jsx.txt','ApexWorld.reference.tsx.txt'])await cp(join(root,'docs',name),join(directory,'docs',name));
 const tests=(await readdir(join(directory,'tests'))).filter(n=>n.endsWith('.test.mjs')).map(n=>'tests/'+n);if(!tests.length)throw new Error('No permitted Node tests found.');
 return new Promise((resolvePromise,reject)=>{const child=spawn(process.execPath,['--test',...tests],{cwd:directory,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot},windowsHide:true,signal,stdio:['ignore','pipe','pipe']});let bytes=0;child.stdout.on('data',d=>bytes+=d.length);child.stderr.on('data',d=>bytes+=d.length);const deadline=setTimeout(()=>child.kill(),60000);child.on('error',e=>{clearTimeout(deadline);reject(new Error('Isolated test process could not start.'));});child.on('close',(code,termination)=>{clearTimeout(deadline);resolvePromise({exitCode:code,termination,tests:tests.length,outputBytes:bytes,passed:code===0,workspace:`developer/${taskId}/test-workspace`,output:'Raw process output is withheld to avoid exposing project secrets. Exit code is actual.'});});});
}
