"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import type {NovaSignal} from './nova/visual-config';
import {HUD_RESPONSE_EVENT,HudResponseLifecycle} from '../lib/hud-response.mjs';
import './hud-response-overlay.css';
type Response={id:string;text:string;stage:string};
export default function HudResponseOverlay({signal}:{signal?:RefObject<NovaSignal>}){
 const [response,setResponse]=useState<Response|null>(null);
 const overlay=useRef<HTMLElement|null>(null),paragraph=useRef<HTMLParagraphElement|null>(null);
 useEffect(()=>{
  const lifecycle=new HudResponseLifecycle((value:Response|null)=>setResponse(value));
  const receive=(event:Event)=>lifecycle.receive((event as CustomEvent).detail);
  window.addEventListener(HUD_RESPONSE_EVENT,receive);
  return()=>{window.removeEventListener(HUD_RESPONSE_EVENT,receive);lifecycle.dispose();};
 },[]);
 useEffect(()=>{if(paragraph.current)paragraph.current.scrollTop=paragraph.current.scrollHeight;},[response?.text]);
 useEffect(()=>{
  if(!response||response.stage!=='visible'||!signal)return;
  let frame=0,smoothed=0;
  const tick=()=>{const input=signal.current.phase==='listening'?signal.current.inputLevel:0;smoothed+=(Math.max(0,Math.min(1,input||0))-smoothed)*.15;overlay.current?.style.setProperty('--transcript-energy',String(smoothed));frame=requestAnimationFrame(tick);};
  tick();return()=>cancelAnimationFrame(frame);
 },[Boolean(response),response?.stage,signal]);
 const words=response?.text.split(/(\s+)/)||[];
 return <section ref={overlay} className="hud-response-overlay" aria-label="Your spoken words" aria-live="polite" aria-atomic="true" data-stage={response?.stage||'empty'}>
  {response&&<div key={response.id} className="hud-response-reveal"><p ref={paragraph} tabIndex={0}>{words.map((word,i)=><span key={`${i}:${word}`} className={i>=words.length-6?'hud-transcript-word recent':'hud-transcript-word'}>{word}</span>)}</p></div>}
 </section>;
}
