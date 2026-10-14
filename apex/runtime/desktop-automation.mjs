import {spawn,execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {connectedRead} from './node-tools.mjs';
import {YouTubeController} from './youtube-controller.mjs';

// Only the user's top-level chat/voice message enters this parser. No model
// output, memory, document text or tool-returned instructions are executed.
export function automationIntent(message){
 if(typeof message!=='string'||message.length>16000)return null;
 let request=message.trim();
 // Conversational lead-ins are allowed only before a direct command. Never
 // scan quoted/document text for an embedded imperative or remove negation.
 for(let i=0;i<6;i++){
  const next=request.replace(/^(?:nah|okay|ok|alright|well|actually|now)[,!:\s]+/i,'').replace(/^(?:(?:hey|hello)\s+)?apex[,.!:\s]+/i,'').replace(/^(?:(?:can|could|would) you\s+|please\s+)/i,'').trim();
  if(next===request)break;request=next;
 }
 if(/^["'`\[]/.test(request))return null;
 if(/^(?:(?:make|put|show|go|switch)(?:\s+(?:it|the video|youtube))?(?:\s+(?:to|in|into))?\s+)?full\s*screen[.!?]?$/i.test(request))return {tool:'YOUTUBE_CONTROL',node:'researcher',action:'fullscreen'};
 if(/^(?:exit|leave|close) full\s*screen[.!?]?$/i.test(request))return {tool:'YOUTUBE_CONTROL',node:'researcher',action:'exit_fullscreen'};
 if(/^(?:pause|stop) (?:the )?(?:video|youtube|playback)[.!?]?$/i.test(request))return {tool:'YOUTUBE_CONTROL',node:'researcher',action:'pause'};
 if(/^(?:resume|continue) (?:the )?(?:video|youtube|playback)[.!?]?$/i.test(request))return {tool:'YOUTUBE_CONTROL',node:'researcher',action:'resume'};
 const play=request.match(/^(?:(?:open|launch)\s+youtube\s+(?:and|then|to)\s+)?play\s+(.+)$/i);
 if(play){
  let query=play[1].replace(/\s+(?:on|from) youtube(?=\s|[.!?]|$)/i,'').replace(/[.!?]$/,'').trim();
  const fullscreen=/(?:\s+(?:and\s+)?(?:in\s+)?full\s*screen)$/i.test(query);
  query=query.replace(/\s+(?:and\s+)?(?:in\s+)?full\s*screen$/i,'').trim();
  if(query)return {tool:'YOUTUBE_CONTROL',node:'researcher',action:'play',query,fullscreen};
 }
 const media=request.match(/^(?:open|launch)\s+youtube\s+(?:and|then|to)\s+(?:play|find|search(?:\s+for)?)\s+(.+)$/i);
 if(media)return {tool:'BROWSER_NAVIGATE',node:'researcher',type:'youtube',query:media[1].trim()};
 let match=request.match(/^(?:open|launch|start)\s+(?:the\s+)?(youtube|google|google maps)(?:\s+for me)?\s*[.!?]?$/i);
 if(match)return {tool:'BROWSER_NAVIGATE',node:'researcher',type:'home',site:match[1].toLowerCase()};
 match=request.match(/^(?:open|launch|start)\s+(?:the\s+)?(chrome|google chrome|edge|microsoft edge|notepad|calculator|calc|terminal|powershell|file explorer|explorer|media player)(?:\s+for me)?\s*[.!?]?$/i);
 if(match)return {tool:'SYSTEM_CONTROL',node:'engineering',action:'open',target:match[1].toLowerCase()};
 if(/^(?:check|show|list) (?:my |the )?(?:running )?processes[.!?]?$/i.test(request))return {tool:'SYSTEM_CONTROL',node:'engineering',action:'processes'};
 match=request.match(/^(?:search (?:the )?(?:web|google)(?: for)?|google)\s+(.+)$/i);
 if(match)return {tool:'BROWSER_NAVIGATE',node:'researcher',type:'search',query:match[1].trim()};
 match=request.match(/^(?:search|play|find)(?: (?:a |the )?video(?:s)?)? (.+?) on youtube[.!?]?$/i)||request.match(/^(?:search youtube(?: for)?|youtube)\s+(.+)$/i);
 if(match)return {tool:'BROWSER_NAVIGATE',node:'researcher',type:'youtube',query:match[1].trim()};
 match=request.match(/^(?:show |get |find )?(?:map directions|directions|navigate)(?: on google maps)? to\s+(.+)$/i);
 if(match)return {tool:'BROWSER_NAVIGATE',node:'ops',type:'maps',query:match[1].trim()};
 if(/^(?:check|show|list|read) (?:my |the )?(?:upcoming )?(?:schedule|meetings|calendar(?: events)?|google calendar)(?:\s+(?:limit\s+)?\d+)?[.!?]?$/i.test(request)){
  const count=request.match(/\b(\d+)\s*[.!?]?$/);return {tool:'CHECK_CALENDAR',node:'calendar',range:'upcoming',limit:Math.max(1,Math.min(50,count?Number(count[1]):10))};
 }
 if(/^(?:draft|compose|prepare) (?:an? )?email\b/i.test(request)){
  match=request.match(/^(?:draft|compose|prepare) (?:an? )?email to\s+([^\s;]+)[;\s]+subject:\s*(.+?)[;\s]+body:\s*([\s\S]+)$/i);
  if(!match)return {tool:'DRAFT_EMAIL',node:'email',missing:true};
  return {tool:'DRAFT_EMAIL',node:'email',recipient:match[1],subject:match[2].trim(),body:match[3].trim()};
 }
 if((/^(?:send|email)\b/i.test(request)&&/email|mail|message|\S+@\S+/.test(request))||/^send (?:it|that)[.!?]?$/i.test(request))return {tool:'DRAFT_EMAIL',node:'email',confirmationRequired:true};
 // Launch requests without a connected handler must never become fictional
 // model-generated execution acknowledgements.
 if(/^(?:open|launch|start)\s+\S/i.test(request))return {tool:'SYSTEM_CONTROL',node:'engineering',unavailable:true};
 return null;
}
export function browserUrl(intent){
 if(intent.type==='home'){
  const sites={youtube:'https://www.youtube.com/',google:'https://www.google.com/','google maps':'https://www.google.com/maps/'};
  if(!Object.hasOwn(sites,intent.site))throw new Error('Unsupported browser destination.');
  return sites[intent.site];
 }
 if(typeof intent.query!=='string'||!intent.query.trim()||intent.query.length>1500)throw new Error('Supply a search query or destination of at most 1500 characters.');
 const url=intent.type==='search'?new URL('https://www.google.com/search'):intent.type==='youtube'?new URL('https://www.youtube.com/results'):intent.type==='maps'?new URL('https://www.google.com/maps/dir/'):null;
 if(!url)throw new Error('Unsupported browser route.');
 if(intent.type==='maps'){url.searchParams.set('api','1');url.searchParams.set('destination',intent.query);}else url.searchParams.set(intent.type==='youtube'?'search_query':'q',intent.query);
 return url.href;
}
export function appLaunch(target,env=process.env,exists=existsSync){
 const system=env.SystemRoot||'C:\\Windows',programs=env.ProgramFiles||'C:\\Program Files',programs32=env['ProgramFiles(x86)']||'C:\\Program Files (x86)';
 const root=env.LOCALAPPDATA||'';
 const candidates={notepad:[join(system,'System32','notepad.exe')],calculator:[join(system,'System32','calc.exe')],terminal:[join(system,'System32','WindowsPowerShell','v1.0','powershell.exe')],explorer:[join(system,'explorer.exe')],
  chrome:[join(programs,'Google','Chrome','Application','chrome.exe'),join(programs32,'Google','Chrome','Application','chrome.exe'),...(root?[join(root,'Google','Chrome','Application','chrome.exe')]:[])],
  edge:[join(programs32,'Microsoft','Edge','Application','msedge.exe'),join(programs,'Microsoft','Edge','Application','msedge.exe')],
  'media player':[join(programs,'Windows Media Player','wmplayer.exe'),join(programs32,'Windows Media Player','wmplayer.exe')]};
 const alias={'google chrome':'chrome','microsoft edge':'edge',calc:'calculator',powershell:'terminal','file explorer':'explorer'};
 const name=alias[target]||target,executable=candidates[name]?.find(exists);
 if(!executable)throw new Error('That application is unavailable or outside the launch allowlist.');
 return {name,executable,args:[]};
}
export function browserLaunch(url,env=process.env,exists=existsSync){
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||!['www.youtube.com','www.google.com'].includes(parsed.hostname))throw new Error('Unsupported browser destination.');
 // explorer.exe can accept a URL and exit without opening a browser. Launch
 // an installed browser directly instead of treating Explorer spawn as success.
 for(const target of ['chrome','edge']){
  try{const app=appLaunch(target,env,exists);return {...app,args:['--new-window',url]};}catch{}
 }
 throw new Error('No supported local browser was found. Install Chrome or Edge before using browser commands.');
}
export function launch(executable,args,{spawnProcess=spawn,signal}={}){
 return new Promise((resolve,reject)=>{
  signal?.throwIfAborted();
  const child=spawnProcess(executable,args,{shell:false,detached:true,stdio:'ignore',windowsHide:false});
  child.once('error',()=>reject(new Error('Windows could not launch the requested application.')));
  child.once('spawn',()=>{child.unref();resolve({submitted:true,pid:child.pid,verifiedWindow:false});});
 });
}
export function launchBrowser(executable,args,{signal,runner=execFile}={}){
 const url=args[1];
 // Fixed PowerShell code; the URL and executable are data, never script text.
 return new Promise((resolve,reject)=>runner('powershell.exe',['-NoProfile','-NonInteractive','-Command',
  "$ErrorActionPreference='Stop'; $apexBrowserProcess = Start-Process -FilePath $env:APEX_BROWSER_EXECUTABLE -ArgumentList @('--new-window', $env:APEX_BROWSER_DESTINATION) -PassThru; @{submitted=$true;pid=$apexBrowserProcess.Id;verifiedWindow=$false} | ConvertTo-Json -Compress"],
  {shell:false,windowsHide:true,timeout:15000,maxBuffer:10000,signal,env:{...process.env,APEX_BROWSER_EXECUTABLE:executable,APEX_BROWSER_DESTINATION:url}},
  (error,stdout)=>{if(error)return reject(new Error('Windows could not open the browser. Run APEX locally from Start.bat with desktop access.'));try{resolve(JSON.parse(stdout));}catch{reject(new Error('Windows did not return a browser launch receipt.'));}}));
}
async function processes(signal){
 return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command','Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 ProcessName,Id,WorkingSet64,CPU | ConvertTo-Json'],{shell:false,windowsHide:true,timeout:8000,maxBuffer:200000,signal},(error,stdout)=>{if(error)return reject(new Error('Process inspection failed.'));try{resolve(JSON.parse(stdout));}catch{reject(new Error('Process inspection returned unreadable data.'));}}));
}
export async function executeAutomation(engine,intent,{signal,launcher=launch,platform=process.platform,processReader=processes,mediaController}={}){
 if(intent.unavailable)return {tool:intent.tool,message:'No connected launch handler matches that request, so I have not opened anything. I can open YouTube, Google, Google Maps, Chrome, Edge, Notepad, Calculator, Terminal, File Explorer or Media Player.',unavailable:true};
 if(intent.missing)return {message:'What recipient email address, subject and message should I use? Format: Draft email to name@example.com subject: Your subject body: Your message.',clarification:true};
 if(intent.confirmationRequired)return {message:'Sending needs the exact recipient, subject and message read back for your confirmation. Prepare or select a draft first, then approve it through the Email node.',confirmationRequired:true};
 const emit=(state,extra={})=>engine.nodeEvent({node:intent.node,tool:intent.tool,state,kind:'tool',summary:`${intent.tool}: ${state}`,...extra});
 emit('working');
 try{
  let receipt,message;
  if(intent.tool==='DRAFT_EMAIL'){
   if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(intent.recipient)||/[\r\n]/.test(intent.subject)||intent.subject.length>300||!intent.body||intent.body.length>8000)throw new Error('Supply one valid recipient, a single-line subject and a message of at most 8000 characters.');
   receipt=engine.store.create('email_draft',{recipient:intent.recipient,to:intent.recipient,subject:intent.subject,body:intent.body,text:intent.body,sent:false,source:'Explicit user-provided draft fields'});
   message=`Draft saved locally; not sent.\nTo: ${receipt.recipient}\nSubject: ${receipt.subject}\n\n${receipt.body}`;
  }else if(intent.tool==='CHECK_CALENDAR'){
   receipt=await connectedRead('calendar',engine.env,signal,engine.fetcher,{limit:intent.limit});
   receipt={...receipt,records:receipt.records.slice(0,intent.limit),displayLimit:intent.limit,totalFetched:receipt.records.length,displayLimited:receipt.records.length>intent.limit};
   message=JSON.stringify(receipt,null,2);
  }else{
   if(platform!=='win32')throw new Error('Desktop automation is available only on the local Windows runtime.');
   if(intent.tool==='YOUTUBE_CONTROL'){
    const browser=browserLaunch('https://www.youtube.com/',engine.env);
    const controller=mediaController||(engine.youtubeController ||= new YouTubeController({env:engine.env}));
    receipt=await controller.execute(intent,{signal,executable:browser.executable});
    if(!receipt.verified)throw new Error('YouTube did not verify the requested action.');
    if(['play','resume'].includes(intent.action)&&!receipt.playing)throw new Error('YouTube playback was not verified.');
    if(intent.action==='fullscreen'&&!receipt.fullscreen)throw new Error('YouTube fullscreen was not verified.');
    if(intent.action==='exit_fullscreen'&&receipt.fullscreen!==false)throw new Error('Leaving YouTube fullscreen was not verified.');
    if(intent.action==='pause'&&!receipt.paused)throw new Error('Pausing YouTube was not verified.');
    message=intent.action==='play'||intent.action==='resume'?`Playing ${receipt.title||'the video'}${receipt.fullscreen?' in fullscreen':''}.`:intent.action==='fullscreen'?'The video is now fullscreen.':intent.action==='exit_fullscreen'?'Exited video fullscreen.':'Video paused.';
   }else if(intent.tool==='BROWSER_NAVIGATE'){
    const url=browserUrl(intent),browser=browserLaunch(url,engine.env);receipt={...await (launcher===launch?launchBrowser:launcher)(browser.executable,browser.args,{signal}),url,browser:browser.name};
    message=intent.type==='home'?`Sent a request to ${browser.name} to open ${intent.site}.`:`Sent the ${intent.type==='youtube'?'YouTube search':intent.type==='maps'?'Google Maps directions':'Google search'} to ${browser.name} for “${intent.query}”. ${intent.type==='youtube'?'Select a video to play.':''}`.trim();
   }else if(intent.action==='open'){
    const app=appLaunch(intent.target,engine.env);receipt={...await launcher(app.executable,app.args,{signal}),target:app.name};message=`Launch request sent for ${app.name}.`;
   }else if(intent.action==='processes'){receipt=await processReader(signal);message=JSON.stringify(receipt,null,2);}
   else throw new Error('This system action is not connected.');
  }
  emit('completed',{result:JSON.stringify(receipt)});return {message,receipt,tool:intent.tool};
 }catch(error){emit('failed',{error:error.message});throw error;}
}
