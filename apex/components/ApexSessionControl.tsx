"use client";
import {useEffect,useState} from 'react';
import {Square} from 'lucide-react';
import './apex-session-control.css';

// Runtime voice events only: animation previews cannot create a live session.
export default function ApexSessionControl(){
 const [session,setSession]=useState({active:false,busy:false,playing:false,captureState:'OFF'});
 useEffect(()=>{const receive=(event:Event)=>setSession((event as CustomEvent).detail);window.addEventListener('apex-hud-voice-status',receive);return()=>window.removeEventListener('apex-hud-voice-status',receive);},[]);
 if(!session.busy&&!session.playing)return null;
 const paused=session.active&&!session.busy&&!session.playing&&session.captureState!=='LISTENING';
 return <button className="apex-session-control" data-speaking={session.playing} aria-label="Stop APEX session" title="Stop speech, microphone and the current reply. Background tasks continue." onClick={()=>window.dispatchEvent(new Event('apex-stop-session'))}>
   <span className="apex-session-light"/><span>{paused?'PAUSED':'LIVE'} · TAP TO STOP</span><Square size={9}/>
 </button>;
}
