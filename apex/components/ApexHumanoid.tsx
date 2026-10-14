"use client";
import {useEffect,useRef,useState,type MutableRefObject} from 'react';
import type {NovaSignal} from './nova/visual-config';
import './apex-humanoid.css';
type Activity='standby'|'listening'|'thinking'|'speaking';
export default function ApexHumanoid({activity,signal,motion}:{activity:Activity;signal:MutableRefObject<NovaSignal>;motion:boolean}){
 const frame=useRef<HTMLIFrameElement>(null),ready=useRef(false);
 const [loaded,setLoaded]=useState(false),[audioStatus,setAudioStatus]=useState('off');
 const sound=true,volume=.35;
 const latest=useRef({activity,motion,sound,volume});latest.current={activity,motion,sound,volume};
 const send=(data:Record<string,unknown>)=>frame.current?.contentWindow?.postMessage({channel:'apex-humanoid-v1',...data},'*');
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{
   if(event.source!==frame.current?.contentWindow||event.data?.channel!=='apex-humanoid-v1')return;
   if(event.data.type==='ready'){ready.current=true;setLoaded(true);}
   if(event.data.type==='audio-status'&&['off','running','suspended','closed','unavailable'].includes(event.data.state))setAudioStatus(event.data.state);
  };
  window.addEventListener('message',receive);
  const timer=setInterval(()=>{
   if(!ready.current)return;
   const state=latest.current,live=signal.current;
   const phase=state.activity==='standby'?'idle':state.activity;
   // Actual input/output envelopes come from the existing microphone/Fish player.
   // Visual previews change expression only; they do not fabricate audio levels.
   send({type:'signal',phase,inputLevel:phase==='listening'?live.inputLevel:0,outputLevel:phase==='speaking'?live.outputLevel:0,motion:state.motion});
   send({type:'audio',enabled:state.sound,volume:state.volume,speaking:live.phase==='speaking'});
  },50);
  return()=>{clearInterval(timer);window.removeEventListener('message',receive);ready.current=false;};
 },[signal]);
 return <section className="apex-humanoid" aria-label="APEX humanoid view" data-audio-status={audioStatus} data-activity={activity}>
  <iframe ref={frame} title="Animated APEX humanoid face" src="/humanoid/apex-entity.html" sandbox="allow-scripts" allow="autoplay; microphone 'none'; camera 'none'" referrerPolicy="no-referrer"/>
  {!loaded&&<p className="humanoid-loading" role="status">Loading humanoid…</p>}
 </section>;
}
