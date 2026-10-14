"use client";
import { useEffect, useState } from 'react';
import LocationHud from './LocationHud';

export default function OverviewCard() {
  const [connected,setConnected]=useState(false);
  const [voice,setVoice]=useState({active:false,busy:false,playing:false,error:''});
  useEffect(()=>{const receive=(event:Event)=>setVoice((event as CustomEvent).detail);window.addEventListener('apex-hud-voice-status',receive);return()=>window.removeEventListener('apex-hud-voice-status',receive);},[]);
  useEffect(()=>{
    let active=true;const controller=new AbortController();
    const check=async()=>{try{const res=await fetch('/api/runtime/state',{cache:'no-store',signal:controller.signal});if(active)setConnected(res.ok);}catch{if(active)setConnected(false);}};
    void check();const timer=setInterval(check,15000);
    return()=>{active=false;controller.abort();clearInterval(timer);};
  },[]);
  return <LocationHud connected={connected} activity={voice.playing?'speaking':voice.busy?'thinking':'idle'} voiceStatus={voice.error?'Mic reconnecting · check voice status':voice.active?'Mic on · wake-word ready':'Mic off'}/>;
}
