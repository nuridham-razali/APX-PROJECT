export const VOICE_INDICATOR_EVENT='apex-voice-indicator';
export function indicatorState(mode,browser,phase,active=false){
 if(mode==='browser'){
  if(!browser?.microphoneEnabled)return 'OFF';
  if(browser.state==='LISTENING')return 'LISTENING';
  if(browser.state==='SPEAKING'&&phase==='speaking')return 'SPEAKING';
  if(['SENDING','WAITING','SPEAKING'].includes(browser.state))return 'THINKING';
  return 'PAUSED';
 }
 return phase==='speaking'?'SPEAKING':phase==='listening'?'LISTENING':phase==='thinking'?'THINKING':active?'IDLE':'OFF';
}

export class VoiceIndicatorVisibility {
 /** @param {(stage:string)=>void} change @param {{schedule?:(fn:()=>void,ms:number)=>any,cancel?:(id:any)=>void}} options */
 constructor(change,{schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){Object.assign(this,{change,schedule,cancel});this.timers=[];this.stage='hidden';}
 clear(){this.timers.forEach(id=>this.cancel(id));this.timers=[];}
 reveal(){this.clear();this.stage='visible';this.change(this.stage);}
 finish(){if(this.stage==='hidden')return;this.clear();this.timers.push(this.schedule(()=>{this.stage='fading';this.change(this.stage);this.timers.push(this.schedule(()=>{this.stage='hidden';this.change(this.stage);},600));},2400));}
 hide(){this.clear();this.stage='hidden';this.change(this.stage);}
 dispose(){this.clear();}
}
