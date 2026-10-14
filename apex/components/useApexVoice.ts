"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import {FluxCapture} from '../lib/flux-capture.mjs';
import {exactSpeechChunks,showHudUserTranscript,finishHudResponse} from '../lib/hud-response.mjs';
import {spokenText} from '../lib/spoken-text.mjs';
import {extractApexWake} from '../lib/wake-phrase.mjs';
import {VOICE_INDICATOR_EVENT} from '../lib/voice-indicator.mjs';
import {WakeGate} from '../lib/wake-gate.mjs';
import type {NovaPhase,NovaSignal} from './nova/visual-config';
export function useApexVoice(signal:RefObject<NovaSignal>,onPhase:(phase:NovaPhase)=>void,playFile:(file:File,waitForEnd?:boolean)=>Promise<void>,onTurn:(words:string)=>void,onSpeechStart?:()=>void,onWake?:()=>void){
  const [recording,setRecording]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[transcript,setTranscript]=useState('');
  const callbacks=useRef({onPhase,onTurn,onSpeechStart,onWake});callbacks.current={onPhase,onTurn,onSpeechStart,onWake};
  const gate=useRef(new WakeGate()),wakeTimeout=useRef<ReturnType<typeof setTimeout>|null>(null);
  const capture=useRef<FluxCapture|null>(null),synthesis=useRef<AbortController|null>(null),starting=useRef<Promise<boolean>|null>(null),mounted=useRef(true);
  useEffect(()=>{
    mounted.current=true;
    capture.current=new FluxCapture({
      onTranscript:(words:string)=>{
        if(!mounted.current||!gate.current.observe(words))return;
        setTranscript(words);const wake=extractApexWake(words);
        if(wake.message)showHudUserTranscript(wake.message);
        if(wake.called){callbacks.current.onWake?.();window.dispatchEvent(new CustomEvent(VOICE_INDICATOR_EVENT,{detail:{action:'reveal'}}));if(wakeTimeout.current)clearTimeout(wakeTimeout.current);wakeTimeout.current=setTimeout(()=>{gate.current.reset();if(signal.current.phase==='listening')callbacks.current.onPhase('idle');},20000);}
      },
      onTurn:(words:string)=>{const accepted=gate.current.consume(words);if(accepted!==null){const final=extractApexWake(accepted).message;if(final)showHudUserTranscript(final);finishHudResponse('apex-user-voice');callbacks.current.onTurn(accepted);}},
      onSpeechStart:()=>{if(gate.current.active)callbacks.current.onSpeechStart?.();},
      onLevel:(level:number)=>{signal.current.inputLevel=level;},
      onError:(message:string)=>{if(mounted.current)setError(message);},
      onState:(state:string)=>{if(!mounted.current)return;setRecording(state==='listening'||state==='paused');setPending(state==='connecting');if(state==='listening')setError('');if(signal.current.phase!=='speaking')callbacks.current.onPhase(state==='listening'&&gate.current.active?'listening':'idle');}
    });
    return()=>{mounted.current=false;if(wakeTimeout.current)clearTimeout(wakeTimeout.current);capture.current?.stop();synthesis.current?.abort();};
  },[]);
  const stop=()=>{gate.current.reset();if(wakeTimeout.current)clearTimeout(wakeTimeout.current);finishHudResponse('apex-user-voice');capture.current?.stop();synthesis.current?.abort();synthesis.current=null;};
  const clearError=()=>setError('');
  const start=async()=>{
    if(starting.current)return starting.current;
    const promise=(async()=>{setError('');setTranscript('');return Boolean(await capture.current?.start({continuous:true,autoReconnect:true}));})();
    starting.current=promise;
    void promise.finally(()=>{if(starting.current===promise)starting.current=null;});
    return promise;
  };
  const finish=async(_language?:string)=>await capture.current?.finish()||'';
  const prepare=async(text:string,abortSignal:AbortSignal)=>{
    text=spokenText(text);
    const r=await fetch('/api/runtime/voice/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assistant:'APEX',text}),signal:abortSignal});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'Fish Audio speech failed.');abortSignal.throwIfAborted();
    return new File([Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0))],'apex-reply.mp3',{type:'audio/mpeg'});
  };
  const speak=async(text:string,waitForEnd=true)=>{
    const request=new AbortController();synthesis.current?.abort();synthesis.current=request;
    try{const chunks=exactSpeechChunks(text);for(const chunk of chunks){const file=await prepare(chunk,request.signal);if(request.signal.aborted||!mounted.current)return;await playFile(file,waitForEnd||chunks.length>1);}}finally{if(synthesis.current===request)synthesis.current=null;}
  };
  return {recording,pending,error,transcript,start,finish,speak,prepare,stop,clearError,pauseCapture:()=>capture.current?.pause(),resumeCapture:()=>capture.current?.resume()};
}
