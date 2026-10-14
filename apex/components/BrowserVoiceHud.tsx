"use client";
import {useEffect,useState} from 'react';
import {BROWSER_VOICE_EVENT,BROWSER_VOICE_COMMAND,PRIVACY_NOTICE} from '../lib/browser-voice-session.mjs';
import './browser-voice-hud.css';
export default function BrowserVoiceHud(){
 const [mode,setMode]=useState('browser'),[voice,setVoice]=useState({state:'OFF',microphoneEnabled:false,handsFree:true,draft:'',editing:false,pendingConsent:false,message:'',privacy:null as null|{local:boolean;message:string}});
 useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.mode)setMode(detail.mode);if(detail?.voice)setVoice(detail.voice);};window.addEventListener(BROWSER_VOICE_EVENT,receive);return()=>window.removeEventListener(BROWSER_VOICE_EVENT,receive);},[]);
 const command=(action:string,value?:string|boolean)=>window.dispatchEvent(new CustomEvent(BROWSER_VOICE_COMMAND,{detail:{action,value}}));
 return <section className={`browser-voice-hud ${mode==='browser'&&(voice.draft||voice.pendingConsent||voice.message)?'has-detail':''}`} aria-label="Hands-free voice controls">
  <label className="browser-voice-input">VOICE INPUT <select aria-label="HUD voice input method" value={mode} onChange={e=>command('input',e.target.value)}><option value="browser">Browser speech</option><option value="deepgram">Deepgram Flux</option></select></label>
  {mode==='deepgram'?<p>Enable MIC once. Pause after your request to send automatically.</p>:<>
  <div className="browser-voice-line"><span>MIC ● {voice.microphoneEnabled?'ON':'OFF'} / {voice.state}</span><label><input type="checkbox" checked={voice.handsFree} onChange={e=>command('handsFree',e.target.checked)}/> HANDS-FREE</label></div>
  {voice.pendingConsent&&<div className="browser-voice-consent"><p>{PRIVACY_NOTICE}</p><button onClick={()=>command('continue')}>CONTINUE WITH BROWSER SPEECH</button><button onClick={()=>command('off')}>KEEP MICROPHONE OFF</button></div>}
  {voice.message&&<p role={voice.state==='ERROR'?'alert':'status'}>{voice.message}</p>}
  {voice.privacy?.local&&<small>{voice.privacy.message}</small>}
  {voice.draft&&!voice.handsFree&&<button onClick={()=>command('send')}>SEND SPOKEN REQUEST</button>}
  {voice.microphoneEnabled&&!voice.editing&&['PAUSED','ERROR','IDLE'].includes(voice.state)&&<button onClick={()=>command('resume')}>RESUME MICROPHONE</button>}
  {voice.microphoneEnabled&&<button onClick={()=>command('stop')}>STOP VOICE</button>}
  {voice.state==='LISTENING'&&voice.handsFree&&!voice.draft&&<small>Speak, then pause for 2.5 seconds to send. Leave MIC on.</small>}
  </>}
 </section>;
}
