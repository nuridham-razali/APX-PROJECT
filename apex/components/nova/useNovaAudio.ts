"use client";
import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import type {NovaSignal,NovaPhase} from './visual-config';
import {voiceFeatures} from './audio-features.mjs';

// Local Web Audio analysis only. Microphone audio is never uploaded by this hook.
export function useNovaAudio(signal:RefObject<NovaSignal>,onPhase:(phase:NovaPhase)=>void){
  const [active,setActive]=useState<'microphone'|'playback'|null>(null),[error,setError]=useState('');
  const resources=useRef<{context:AudioContext;stream?:MediaStream;audio?:HTMLAudioElement;url?:string;frame:number;finish?:(error?:Error)=>void;timer?:ReturnType<typeof setTimeout>}|null>(null);
  const generation=useRef(0),mounted=useRef(true),callback=useRef(onPhase);callback.current=onPhase;
  const stop=useCallback(()=>{generation.current++;const r=resources.current;resources.current=null;if(r){r.finish?.(new DOMException('Playback stopped.','AbortError'));clearTimeout(r.timer);cancelAnimationFrame(r.frame);r.stream?.getTracks().forEach(t=>t.stop());if(r.audio){r.audio.onended=null;r.audio.onerror=null;r.audio.pause();r.audio.removeAttribute('src');r.audio.load();}if(r.url)URL.revokeObjectURL(r.url);void r.context.close().catch(()=>{});}signal.current.inputLevel=0;signal.current.outputLevel=0;if(mounted.current){setActive(null);callback.current('idle');}},[signal]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop();};},[stop]);
  const connect=(context:AudioContext,analyser:AnalyserNode,kind:'microphone'|'playback',r:NonNullable<typeof resources.current>)=>{
    signal.current.outputTone=0;
    const values=new Uint8Array(analyser.fftSize),spectrum=new Uint8Array(analyser.frequencyBinCount);
    analyser.smoothingTimeConstant=.25;
    let features={level:0,tone:0},last=performance.now();
    resources.current=r;setActive(kind);callback.current(kind==='microphone'?'listening':'speaking');
    const sample=()=>{if(resources.current!==r)return;const now=performance.now();analyser.getByteTimeDomainData(values);analyser.getByteFrequencyData(spectrum);features=voiceFeatures(values,spectrum,context.sampleRate,analyser.fftSize,features,(now-last)/1000);last=now;if(kind==='microphone')signal.current.inputLevel=features.level;else{signal.current.outputLevel=features.level;signal.current.outputTone=features.tone;}r.frame=requestAnimationFrame(sample);};sample();
  };
  const startMic=async()=>{stop();setError('');const id=generation.current;let stream:MediaStream|undefined;let context:AudioContext|undefined;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone capture is unavailable.');stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});if(id!==generation.current||!mounted.current){stream.getTracks().forEach(t=>t.stop());return;}context=new AudioContext();await context.resume();if(id!==generation.current||!mounted.current){stream.getTracks().forEach(t=>t.stop());void context.close();return;}const analyser=context.createAnalyser();analyser.fftSize=512;context.createMediaStreamSource(stream).connect(analyser);connect(context,analyser,'microphone',{context,stream,frame:0});}catch(e){stream?.getTracks().forEach(t=>t.stop());void context?.close().catch(()=>{});if(mounted.current)setError(e instanceof Error?e.message:'Microphone unavailable.');}};
  const playFile=async(file:File,waitForEnd=false,onStarted?:()=>void)=>{
    stop();setError('');const id=generation.current;let context:AudioContext|undefined,url:string|undefined;
    try{
      context=new AudioContext();await context.resume();
      if(id!==generation.current||!mounted.current){void context.close();if(waitForEnd)throw new DOMException('Playback stopped.','AbortError');return;}
      url=URL.createObjectURL(file);const audio=new Audio(url);audio.volume=1;audio.muted=false;audio.preload='auto';const analyser=context.createAnalyser();analyser.fftSize=512;
      context.createMediaElementSource(audio).connect(analyser);analyser.connect(context.destination);
      const r:NonNullable<typeof resources.current>={context,audio,url,frame:0};
      let complete:Promise<void>|undefined;
      if(waitForEnd){complete=new Promise<void>((resolve,reject)=>{r.finish=error=>{r.finish=undefined;error?reject(error):resolve();};});void complete.catch(()=>{});}
      audio.onended=()=>{r.finish?.();stop();};
      audio.onerror=()=>{const error=new Error('This audio file could not be played.');r.finish?.(error);stop();if(mounted.current)setError(error.message);};
      resources.current=r;
      if(waitForEnd)r.timer=setTimeout(()=>{r.finish?.(new Error('Speech playback timed out. Start voice conversation again.'));stop();},180000);
      await audio.play();
      if(resources.current===r){connect(context,analyser,'playback',r);onStarted?.();}
      if(waitForEnd)await complete;
    }catch(e){stop();if(url)URL.revokeObjectURL(url);void context?.close().catch(()=>{});if(mounted.current&&!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Audio playback unavailable.');if(waitForEnd)throw e;}
  };
  return {active,error,startMic,playFile,stop};
}

