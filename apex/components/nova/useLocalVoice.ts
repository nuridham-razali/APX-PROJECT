"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import type {NovaSignal,NovaPhase} from './visual-config';
import {voiceFeatures} from './audio-features.mjs';
import {SpeechGate} from '../../lib/continuous-voice.mjs';
type CaptureOptions={onUtterance?:(kind:'speech'|'idle')=>void;onQuiet?:()=>void;onError?:(message:string)=>void};

export function useLocalVoice(signal:RefObject<NovaSignal>,onPhase:(phase:NovaPhase)=>void,playFile:(file:File,waitForEnd?:boolean)=>Promise<void>,assistant='APEX'){
  const [recording,setRecording]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
  const session=useRef<{recorder:MediaRecorder;stream:MediaStream;context:AudioContext;frame:number;timer:ReturnType<typeof setTimeout>;result:Promise<Blob>}|null>(null);
  const controller=useRef<AbortController|null>(null),generation=useRef(0),mounted=useRef(true);
  const cleanup=()=>{const r=session.current;session.current=null;if(r){clearTimeout(r.timer);cancelAnimationFrame(r.frame);if(r.recorder.state!=='inactive')r.recorder.stop();r.stream.getTracks().forEach(t=>t.stop());void r.context.close().catch(()=>{});}signal.current.inputLevel=0;if(mounted.current)setRecording(false);};
  const stop=()=>{generation.current++;controller.current?.abort();controller.current=null;cleanup();if(mounted.current)setPending(false);};
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop();};},[]);
  const start=async(options:CaptureOptions={})=>{
    stop();setError('');const id=generation.current;let stream:MediaStream|undefined;let captureContext:AudioContext|undefined;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      if(id!==generation.current||!mounted.current){stream.getTracks().forEach(t=>t.stop());return false;}
      const context=new AudioContext();captureContext=context;await context.resume();
      if(id!==generation.current||!mounted.current){stream.getTracks().forEach(t=>t.stop());void context.close();return false;}
      const recorder=new MediaRecorder(stream),chunks:BlobPart[]=[];
      const analyser=context.createAnalyser();analyser.fftSize=512;context.createMediaStreamSource(stream).connect(analyser);
      const values=new Uint8Array(512),spectrum=new Uint8Array(256);let previous={level:0,tone:0};
      const gate=new SpeechGate();let autoFinished=false;let quietSince=performance.now();let heardVoice=false;
      const result=new Promise<Blob>(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}));});
      const r={recorder,stream,context,frame:0,timer:setTimeout(()=>{if(options.onUtterance){autoFinished=true;options.onUtterance(gate.hasSpeech?'speech':'idle');}else{stop();setError('Recording stopped after 30 seconds. Try a shorter request.');onPhase('idle');}},30000),result};session.current=r;
      const meter=()=>{if(session.current!==r)return;analyser.getByteTimeDomainData(values);previous=voiceFeatures(values,spectrum,context.sampleRate,512,previous);signal.current.inputLevel=previous.level;let power=0;for(const value of values)power+=((value-128)/128)**2;const rms=Math.sqrt(power/values.length),now=performance.now();if(rms>.014){quietSince=now;heardVoice=true;}if(options.onUtterance&&!autoFinished&&gate.sample(rms,now)){autoFinished=true;clearTimeout(r.timer);options.onUtterance('speech');return;}if(!heardVoice&&now-quietSince>=2500)options.onQuiet?.();if(session.current===r)r.frame=requestAnimationFrame(meter);};
      recorder.onerror=()=>{const message='Microphone recording failed. Start voice conversation again or use text.';if(options.onError)options.onError(message);else{stop();setError(message);onPhase('idle');}};
      recorder.start();setRecording(true);onPhase('listening');meter();return true;
    }catch{stream?.getTracks().forEach(t=>t.stop());void captureContext?.close().catch(()=>{});const message='Microphone could not start. Check browser permission or type your message.';if(id===generation.current&&mounted.current){setError(message);onPhase('idle');options.onError?.(message);}return false;}
  };
  const finish=async(language:string)=>{
    const r=session.current;if(!r)return '';
    const id=generation.current;cleanup();setPending(true);onPhase('thinking');
    const request=new AbortController();controller.current=request;
    try{
      const blob=await r.result;if(id!==generation.current)return '';
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const res=await fetch('/api/runtime/voice/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:btoa(binary),language}),signal:request.signal});const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Local transcription failed.');
      if(!data.text?.trim())throw new Error('No clear speech detected. Try again or type your message.');
      return data.text.trim() as string;
    }catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'Voice input failed.');return '';}
    finally{if(id===generation.current){setPending(false);onPhase('idle');controller.current=null;}}
  };
  const speak=async(text:string,waitForEnd=false)=>{
    const request=new AbortController();controller.current=request;const id=generation.current;
    const res=await fetch('/api/runtime/voice/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assistant,text:text.replace(/[#*_`]/g,'').slice(0,1500)}),signal:request.signal});const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Speech synthesis failed.');
    if(id!==generation.current)return;
    const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));
    const mime=data.mime==='audio/mpeg'?'audio/mpeg':'audio/wav';
    await playFile(new File([bytes],`assistant-reply.${mime==='audio/mpeg'?'mp3':'wav'}`,{type:mime}),waitForEnd);
    if(controller.current===request)controller.current=null;
  };
  return {recording,pending,error,start,finish,speak,stop};
}
