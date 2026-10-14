export const BROWSER_VOICE_EVENT='apex-browser-voice-state';
import {extractApexWake} from './wake-phrase.mjs';
export const BROWSER_VOICE_COMMAND='apex-browser-voice-command';
export const PRIVACY_NOTICE='Browser speech recognition may send audio to an online service. APEX could not verify where speech is processed in this browser.';
export const PRIVACY_OFF='APEX could not verify where browser speech recognition processes audio. Microphone remains OFF.';
export const VOICE_ERRORS={recognition:'Speech recognition failed. Hands-free mode is paused.',ai:'AI response failed. Hands-free mode is paused.',audio:'Voice playback failed. Hands-free mode is paused.'};

// No recognition.start(), permission request, language-pack installation or
// audio capture is performed by capability detection.
export async function browserSpeechPrivacy(Constructor,lang='en-US'){
 if(!Constructor)return {supported:false,local:false,message:'Hands-free speech recognition is not supported by this browser.'};
 try{
  const probe=new Constructor();
  if('processLocally' in probe&&typeof Constructor.available==='function'){
   let deadline;const status=await Promise.race([Constructor.available({langs:[lang],processLocally:true}),new Promise(resolve=>{deadline=setTimeout(()=>resolve('unknown'),4000);})]).finally(()=>clearTimeout(deadline));
   if(status==='available'){probe.processLocally=true;if(probe.processLocally===true)return {supported:true,local:true,message:'Browser confirmed on-device recognition for '+lang+'.'};}
  }
 }catch{}
 return {supported:true,local:false,message:PRIVACY_NOTICE};
}

export class BrowserVoiceSession {
 /** @param {{getConstructor?:()=>any,onChange?:(value:any)=>void,submit?:(text:string,signal:AbortSignal)=>Promise<void>,onWake?:((signal:AbortSignal)=>Promise<void>)|null,stopOutput?:()=>void,active?:()=>boolean,schedule?:(fn:()=>void,ms:number)=>any,cancel?:(id:any)=>void,lang?:string}} options */
 constructor({getConstructor=()=>globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition,onChange=()=>{},submit=async()=>{},onWake=null,stopOutput=()=>{},active=()=>true,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),lang='en-US'}={}){
  Object.assign(this,{getConstructor,onChange,submit,onWake,stopOutput,active,schedule,cancel,lang});
  this.generation=0;this.recognition=null;this.request=null;this.timer=null;this.restartTimer=null;this.startTimer=null;this.state='OFF';this.microphoneEnabled=false;this.handsFree=true;this.draft='';this.editing=false;this.privacy=null;this.pendingConsent=false;this.message='';this.restartUsed=false;this.disposed=false;this.speakingInput=false;
  this.wakeRevision=0;this.wakeWaiting=false;
 }
 snapshot(){return {state:this.state,microphoneEnabled:this.microphoneEnabled,handsFree:this.handsFree,draft:this.draft,editing:this.editing,privacy:this.privacy,pendingConsent:this.pendingConsent,message:this.message,wakeRevision:this.wakeRevision,wakeWaiting:this.wakeWaiting,speechActive:this.speakingInput};}
 publish(){if(!this.disposed)this.onChange(this.snapshot());}
 setState(state,message=''){this.state=state;this.message=message;this.publish();}
 clearTimers(){for(const name of ['timer','restartTimer','startTimer']){if(this[name]!==null)this.cancel(this[name]);this[name]=null;}}
 detach(){const r=this.recognition;this.recognition=null;if(r){r.onstart=r.onresult=r.onend=r.onerror=r.onspeechstart=r.onspeechend=null;try{r.abort();}catch{}}}
 valid(id){return !this.disposed&&id===this.generation;}
 async enable(){
  this.off();const id=this.generation;this.setState('OFF','Checking browser speech support…');
  const privacy=await browserSpeechPrivacy(this.getConstructor(),this.lang);if(!this.valid(id))return;
  this.privacy=privacy;if(!privacy.supported){this.setState('OFF',privacy.message);return;}
  if(!privacy.local){this.pendingConsent=true;this.setState('OFF',PRIVACY_OFF);return;}
  this.microphoneEnabled=true;this.restartUsed=false;this.listen();
 }
 continueUnknown(){if(this.disposed||!this.pendingConsent||!this.privacy?.supported||!this.active())return;this.pendingConsent=false;this.microphoneEnabled=true;this.restartUsed=false;this.listen();}
 off(){this.generation++;this.clearTimers();this.detach();this.request?.abort(new DOMException('Voice session stopped.','AbortError'));this.request=null;this.microphoneEnabled=false;this.pendingConsent=false;this.draft='';this.wakeWaiting=false;this.editing=false;this.speakingInput=false;this.stopOutput();this.setState('OFF');}
 eligible(){return !this.disposed&&this.microphoneEnabled&&this.handsFree&&!this.request&&!this.editing&&this.active();}
 listen(){
  if(this.disposed||!this.microphoneEnabled||this.request||this.editing||!this.active()){if(this.microphoneEnabled)this.setState('PAUSED','Microphone paused.');return;}
  this.clearTimers();this.detach();const id=this.generation;const Constructor=this.getConstructor();let r;
  try{if(!Constructor)throw Error('Unsupported');r=new Constructor();this.recognition=r;r.lang=this.lang;r.continuous=true;r.interimResults=true;if(this.privacy?.local){r.processLocally=true;if(r.processLocally!==true)throw Error('On-device recognition could not be enforced.');}}
  catch{this.fail('recognition');return;}
  const live=()=>this.valid(id)&&this.recognition===r;
  let base=this.draft,results=[],wakeNotified=false;
  r.onstart=()=>{if(!live())return;this.cancel(this.startTimer);this.startTimer=null;this.setState('LISTENING');if(this.draft)this.arm();};
  r.onspeechstart=()=>{if(!live())return;if(this.wakeWaiting&&!this.draft){base='';results=[];wakeNotified=false;}this.speakingInput=true;this.cancel(this.timer);this.timer=null;this.publish();};
  r.onspeechend=()=>{if(!live())return;this.speakingInput=false;this.publish();this.arm();};
  r.onresult=event=>{
   if(!live()||this.editing||this.state!=='LISTENING')return;
   for(let i=event.resultIndex||0;i<event.results.length;i++){results[i]=String(event.results[i]?.[0]?.transcript||'');}
   results.length=event.results.length;const raw=[base,...results].filter(Boolean).join(' ').trim().slice(0,16000),wake=extractApexWake(raw);
   if(wake.called&&!wakeNotified){this.wakeRevision++;wakeNotified=true;}
   // A final recognition result also ends its speech segment. Some browsers
   // omit speechend, leaving the activity flag stuck and preventing auto-send.
   // Keep the inactivity delay: a new segment/result resets it before submission.
   if(event.results.length&&event.results[event.results.length-1]?.isFinal===true)this.speakingInput=false;
   this.draft=wake.message;this.wakeWaiting=wake.called&&!this.draft;this.publish();this.arm();
  };
  r.onerror=()=>{if(live())this.fail('recognition');};
  r.onend=()=>{
   if(!live())return;this.recognition=null;this.cancel(this.startTimer);this.startTimer=null;
   // End is never a send trigger. Keep the existing inactivity deadline.
   if(!this.eligible()){this.setState('PAUSED','Microphone paused.');return;}
   if(this.restartUsed){this.clearTimers();this.setState('PAUSED','Microphone paused.');return;}
   this.restartUsed=true;this.setState('IDLE','Restarting microphone once…');
   this.restartTimer=this.schedule(()=>{this.restartTimer=null;if(this.valid(id)&&this.eligible())this.listen();},300);
  };
  this.setState('IDLE','Starting microphone…');
  this.startTimer=this.schedule(()=>{if(live()&&this.state==='IDLE'){this.detach();this.setState('PAUSED','Microphone paused.');}},5000);
  try{r.start();}catch{this.clearTimers();this.detach();this.setState('PAUSED','Microphone paused.');}
 }
 arm(){
  this.cancel(this.timer);this.timer=null;if(this.editing||!this.handsFree||!this.microphoneEnabled||!this.draft.trim()&&!(this.wakeWaiting&&this.onWake))return;
  const id=this.generation;this.timer=this.schedule(()=>{this.timer=null;if(this.valid(id)&&!this.editing&&!this.speakingInput&&this.microphoneEnabled&&!this.request&&this.active()){
   if(this.draft.trim())void this.send();
   else if(this.wakeWaiting&&this.onWake){this.wakeWaiting=false;void this.announce(signal=>this.onWake(signal)).catch(()=>{});}
  }},2500);
 }
 edit(text){this.generation++;this.clearTimers();this.detach();this.request?.abort();this.request=null;this.stopOutput();this.editing=true;this.speakingInput=false;this.draft=String(text).slice(0,16000);this.setState('PAUSED','Editing transcript. Press SEND to submit.');}
 cancelDraft(){this.generation++;this.clearTimers();this.detach();this.request?.abort();this.request=null;this.stopOutput();this.draft='';this.wakeWaiting=false;this.editing=false;this.speakingInput=false;if(this.eligible())this.listen();else this.setState(this.microphoneEnabled?'PAUSED':'OFF');}
 async send(){
  const text=this.draft.trim();if(!text||this.request||this.disposed)return;
  this.generation++;const id=this.generation;this.clearTimers();this.detach();this.speakingInput=false;this.draft='';this.wakeWaiting=false;this.editing=false;this.restartUsed=false;
  const request=new AbortController();this.request=request;this.setState('SENDING');
  try{const work=this.submit(text,request.signal);if(this.valid(id))this.setState('WAITING');await work;if(!this.valid(id)||request.signal.aborted)return;this.request=null;if(this.eligible())this.listen();else this.setState(this.microphoneEnabled?'IDLE':'OFF');}
  catch(error){if(!this.valid(id)||request.signal.aborted)return;this.request=null;this.fail(error?.voiceStage==='audio'?'audio':'ai');}
 }
 playing(){if(this.request&&!this.request.signal.aborted)this.setState('SPEAKING');}
 // Background work has no recognition ownership. Only its foreground audio
 // announcement pauses capture, and never while the user has an unfinished draft.
 async announce(play){
  if(this.disposed||this.request||this.editing||this.draft||this.speakingInput||!this.active()||this.microphoneEnabled&&(!this.handsFree||this.state!=='LISTENING'))return false;
  this.generation++;const id=this.generation;this.clearTimers();this.detach();
  const request=new AbortController();this.request=request;this.setState('WAITING');
  try{await play(request.signal);if(!this.valid(id)||request.signal.aborted)return true;this.request=null;if(this.eligible())this.listen();else this.setState(this.microphoneEnabled?'IDLE':'OFF');}
  catch(error){if(this.valid(id)&&!request.signal.aborted){this.request=null;this.fail('audio');}throw error;}
  return true;
 }
 fail(kind){this.generation++;this.clearTimers();this.detach();this.request?.abort();this.request=null;this.speakingInput=false;this.stopOutput();this.setState('ERROR',VOICE_ERRORS[kind]||VOICE_ERRORS.recognition);}
 pause(message='Microphone paused.') {this.generation++;this.clearTimers();this.detach();this.request?.abort();this.request=null;this.speakingInput=false;this.stopOutput();this.setState(this.microphoneEnabled?'PAUSED':'OFF',message);}
 resume(){if(this.disposed||!this.microphoneEnabled||this.request||this.editing)return;this.generation++;this.restartUsed=false;this.listen();}
 stop(){this.generation++;this.clearTimers();this.detach();this.request?.abort(new DOMException('Speech stopped.','AbortError'));this.request=null;this.stopOutput();this.draft='';this.wakeWaiting=false;this.editing=false;this.speakingInput=false;if(this.eligible())this.listen();else this.setState(this.microphoneEnabled?'IDLE':'OFF');}
 setHandsFree(value){this.handsFree=Boolean(value);this.clearTimers();if(this.handsFree&&this.state==='LISTENING')this.arm();this.publish();}
 dispose(){this.off();this.disposed=true;}
}
