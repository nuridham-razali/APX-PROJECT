export const HUD_RESPONSE_EVENT='apex-hud-response';
export const HUD_REVEAL_MS=180;
export const HUD_HOLD_MS=3000;
export const HUD_FADE_MS=1200;

// Only completed response text belongs here. Status messages never replace it.
export function showHudResponse(id,text){window.dispatchEvent(new CustomEvent(HUD_RESPONSE_EVENT,{detail:{type:'show',id,text}}));}
export function showHudUserTranscript(text){window.dispatchEvent(new CustomEvent(HUD_RESPONSE_EVENT,{detail:{type:'user',id:'apex-user-voice',text}}));}
export function finishHudResponse(id){window.dispatchEvent(new CustomEvent(HUD_RESPONSE_EVENT,{detail:{type:'finish',id}}));}

export class HudResponseLifecycle {
 constructor(onChange,{schedule=(fn,ms)=>setTimeout(fn,ms),cancel=timer=>clearTimeout(timer)}={}){Object.assign(this,{onChange,schedule,cancel});this.value=null;this.timers=[];}
 clear(){for(const timer of this.timers)this.cancel(timer);this.timers=[];}
 receive(detail){if(detail?.type==='user')this.show(detail.id,detail.text);else if(detail?.type==='finish')this.finish(detail.id);}
 show(id,text){if(typeof id!=='string'||typeof text!=='string'||!text.trim())return;this.clear();this.value={id,text,stage:'visible'};this.onChange(this.value);}
 finish(id){if(this.value?.id!==id||this.value.stage!=='visible')return;this.clear();this.timers.push(this.schedule(()=>{if(this.value?.id!==id)return;this.value={...this.value,stage:'fading'};this.onChange(this.value);this.timers.push(this.schedule(()=>{if(this.value?.id!==id)return;this.value=null;this.onChange(null);},HUD_FADE_MS));},HUD_HOLD_MS));}
 dispose(){this.clear();this.value=null;}
}

// Keep all characters, including Markdown and whitespace, across provider-sized
// chunks. Concatenation is exactly the saved response, with no speech summary.
export function exactSpeechChunks(text,maxChars=1500){
 if(typeof text!=='string'||!text.trim())throw new Error('Response text is empty.');
 if(!Number.isInteger(maxChars)||maxChars<4)throw new Error('Invalid speech chunk limit.');
 const chunks=[];let rest=text;
 while(rest.length>maxChars){
  let end=maxChars;const space=rest.lastIndexOf(' ',maxChars-1);
  if(space>=maxChars/2)end=space+1;
  if(/[\uD800-\uDBFF]/.test(rest[end-1]))end--;
  chunks.push(rest.slice(0,end));rest=rest.slice(end);
 }
 if(rest)chunks.push(rest);return chunks;
}

export function waitForHudReveal(signal){
 signal.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);reject(signal.reason||new DOMException('Interrupted','AbortError'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},HUD_REVEAL_MS);
  signal.addEventListener('abort',abort,{once:true});
 });
}
