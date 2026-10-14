"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import {Mic,MicOff,X} from 'lucide-react';
import {BROWSER_VOICE_EVENT} from '../lib/browser-voice-session.mjs';
import {VOICE_INDICATOR_EVENT,indicatorState,VoiceIndicatorVisibility} from '../lib/voice-indicator.mjs';
import type {NovaSignal} from './nova/visual-config';
import './wake-voice-indicator.css';
type Snapshot={state:string;microphoneEnabled:boolean;wakeRevision?:number;wakeWaiting?:boolean;speechActive?:boolean};
export default function WakeVoiceIndicator({mode,phase,signal,active=false,error=''}:{mode:string;phase:string;signal:RefObject<NovaSignal>;active?:boolean;error?:string}){
 const [stage,setStage]=useState('hidden'),[voice,setVoice]=useState<Snapshot>({state:'OFF',microphoneEnabled:false});
 const controller=useRef<VoiceIndicatorVisibility|null>(null),previous=useRef('OFF'),revision=useRef(0),wave=useRef<SVGSVGElement|null>(null),statusRef=useRef('OFF'),manualRequested=useRef(false);
 const status=indicatorState(mode,voice,phase,active);
 statusRef.current=status;
 useEffect(()=>{
  const visibility=new VoiceIndicatorVisibility((next:string)=>setStage(next));controller.current=visibility;
  const receive=(event:Event)=>{const value=(event as CustomEvent).detail?.voice as Snapshot|undefined;if(!value)return;setVoice(value);if((value.wakeRevision||0)>revision.current){revision.current=value.wakeRevision||0;if(value.microphoneEnabled&&value.state==='LISTENING')visibility.reveal();}};
  const activate=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.action==='hide'){manualRequested.current=false;visibility.hide();}else{if(detail?.reason==='manual')manualRequested.current=true;visibility.reveal();if(['OFF','PAUSED'].includes(statusRef.current))visibility.finish();}};
  window.addEventListener(BROWSER_VOICE_EVENT,receive);window.addEventListener(VOICE_INDICATOR_EVENT,activate);
  return()=>{window.removeEventListener(BROWSER_VOICE_EVENT,receive);window.removeEventListener(VOICE_INDICATOR_EVENT,activate);visibility.dispose();};
 },[]);
 useEffect(()=>{previous.current=status;if(['LISTENING','THINKING','SPEAKING'].includes(status)){manualRequested.current=false;controller.current?.reveal();}else controller.current?.finish();},[status]);
 useEffect(()=>{
  if(stage==='hidden')return;let frame=0;
  const tick=()=>{const level=status==='SPEAKING'?signal.current.outputLevel:status==='LISTENING'&&mode!=='browser'?signal.current.inputLevel:voice.speechActive ? .35 : 0;
   wave.current?.style.setProperty('--voice-level',String(Math.max(0,Math.min(1,level||0))));frame=requestAnimationFrame(tick);};tick();return()=>cancelAnimationFrame(frame);
 },[stage,status,mode,voice.speechActive,signal]);
 const micActive=mode==='browser'?voice.microphoneEnabled&&voice.state!=='OFF':active;
 if(stage==='hidden')return <button className="wake-voice-restore" aria-label="Show APEX microphone indicator" title="Show microphone controls" onClick={()=>{controller.current?.reveal();if(['IDLE','OFF','PAUSED'].includes(status))controller.current?.finish();}}>{micActive?<Mic size={13}/>:<MicOff size={13}/>}</button>;
 const displayStatus=error?'ERROR':status;
 return <section className="wake-voice-indicator" data-stage={stage} data-status={status} data-input-active={status==='LISTENING'&&voice.speechActive} aria-label="APEX voice indicator">
  <span className="wake-voice-name"><Mic size={12}/> APEX</span>
  <svg ref={wave} viewBox="0 0 88 28" className="wake-voice-wave" aria-hidden="true">{Array.from({length:15},(_,i)=><rect key={i} x={i*6} y={14-(4+(7-Math.abs(7-i))*2)/2} width="2" height={4+(7-Math.abs(7-i))*2} rx="1" style={{animationDelay:`${i*-.09}s`}}/>)}</svg>
  <span className="wake-voice-status" role="status" title={error||undefined}>{displayStatus}</span>
  <button className="wake-voice-mic" aria-label={micActive?'Mute APEX microphone':'Enable APEX microphone'} title={micActive?'Mute microphone':'Enable microphone'} onClick={()=>window.dispatchEvent(new Event('apex-hud-toggle-voice'))}>{micActive?<Mic size={11}/>:<MicOff size={11}/>}</button>
  {['IDLE','OFF','PAUSED'].includes(status)&&<button aria-label="Hide APEX microphone indicator" title="Hide indicator · microphone stays unchanged" onClick={()=>controller.current?.hide()}><X size={11}/></button>}
 </section>;
}
