"use client";
import {useEffect,useRef,type RefObject} from 'react';
import type {NovaSignal} from './visual-config';

export default function NovaWaveform({signal,motion}:{signal:RefObject<NovaSignal>;motion:boolean}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const el=canvas.current!,ctx=el.getContext('2d');if(!ctx)return;const d=Math.min(devicePixelRatio,1.5);el.width=260*d;el.height=42*d;ctx.setTransform(d,0,0,d,0,0);let frame=0;const render=(t:number)=>{ctx.clearRect(0,0,260,42);const s=signal.current;const level=s.phase==='listening'?s.inputLevel:s.phase==='speaking'?s.outputLevel:0;const preview=s.preview&&(s.phase==='listening'||s.phase==='speaking');const energy=motion?(preview ? .18+Math.sin(t*.0017)*.06 : level):0;const marker=el.parentElement?.querySelector<HTMLElement>('.nova-mic-marker');if(marker)marker.hidden=s.inputLevel<.02;for(let i=0;i<58;i++){const x=14+i*4;const center=Math.pow(Math.max(0,1-Math.abs(i-28.5)/28.5),.65);const ripple=.4+.6*Math.abs(Math.sin(i*.7+t*.006));const height=1.3+energy*32*center*ripple;ctx.fillStyle=i%3?'rgba(245,233,255,.43)':'rgba(224,64,251,.65)';ctx.fillRect(x,21-height/2,1,height);}if(motion)frame=requestAnimationFrame(render);};render(0);return()=>cancelAnimationFrame(frame);},[signal,motion]);
  return <canvas ref={canvas} className="nova-waveform" aria-label="NOVA waveform driven by microphone or output audio; preview animation is labeled separately" role="img" />;
}
