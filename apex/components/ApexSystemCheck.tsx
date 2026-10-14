"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import {Check,AlertTriangle,LoaderCircle,Minus,Volume2,X} from 'lucide-react';
import {useNovaAudio} from './nova/useNovaAudio';
import type {NovaSignal,NovaPhase} from './nova/visual-config';
import type {Diagnostic} from './runtime-types';
import {consumeCheckStream,diagnosticAnnouncement} from '../lib/system-check.mjs';
import {SystemCheckSounds} from '../lib/system-check-sounds.mjs';
import {showHudResponse,finishHudResponse,waitForHudReveal} from '../lib/hud-response.mjs';
import {checkPresentationStage,revealedCheckCount,CHECK_PRESENTATION_STAGES,checkOutcome} from '../lib/check-presentation.mjs';
import './apex-system-check.css';

export default function ApexSystemCheck({open,onClose,signal,onPhase,onStage}:{open:boolean;onClose:()=>void;signal:RefObject<NovaSignal>;onPhase:(phase:NovaPhase)=>void;onStage:(stage:string)=>void}){
  const [elapsed,setElapsed]=useState(0),[report,setReport]=useState<Diagnostic|null>(null),[error,setError]=useState(''),[speech,setSpeech]=useState('');
  const [muted,setMuted]=useState(false),[volume,setVolume]=useState(.35),[announce,setAnnounce]=useState(true);
  const preferences=useRef({muted,volume,announce});preferences.current={muted,volume,announce};
  const effects=useRef<SystemCheckSounds|null>(null),callbacks=useRef({onPhase,onStage,onClose});callbacks.current={onPhase,onStage,onClose};
  const audio=useNovaAudio(signal,phase=>{effects.current?.duck(phase==='speaking');callbacks.current.onPhase(phase);});
  const stage=checkPresentationStage(elapsed,report?.state==='completed');
  useEffect(()=>{callbacks.current.onStage(open?stage:'');},[stage,open]);
  useEffect(()=>{effects.current?.configure(muted,volume);},[muted,volume]);
  useEffect(()=>{
    if(!open)return;
    const request=new AbortController();let live=true,sounds:SystemCheckSounds|null=null,latest:Diagnostic|null=null,completedSound=false,completion:Promise<void>|undefined;
    const responseId=crypto.randomUUID();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,started=performance.now(),seen=new Set<string>(),cues=new Set<string>();
    setElapsed(0);setReport(null);setError('');setSpeech('');callbacks.current.onPhase('thinking');
    const clock=()=>{
      const time=(performance.now()-started)/1000*(reduced?10:1);setElapsed(time);
      if(!reduced)for(const [name,boundary] of CHECK_PRESENTATION_STAGES){if(time>=boundary&&!cues.has(name)){cues.add(name);if(time-boundary<.45)sounds?.cue(name);}}
      if(latest)for(const check of latest.checks.slice(0,revealedCheckCount(time,latest.checks.length))){if(['passed','failed','skipped'].includes(check.state)&&!seen.has(check.id)){seen.add(check.id);sounds?.result(check.state);}}
      if(time>=15.5&&latest?.state==='completed'&&!completedSound){completedSound=true;completion=sounds?.complete();callbacks.current.onPhase('idle');}
    };
    const timer=setInterval(clock,100);
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')callbacks.current.onClose();};window.addEventListener('keydown',escape);
    const wait=(ms:number)=>new Promise<void>((resolve,reject)=>{const done=()=>{request.signal.removeEventListener('abort',abort);resolve();};const delay=setTimeout(done,Math.max(0,ms));const abort=()=>{clearTimeout(delay);reject(new DOMException('Closed','AbortError'));};request.signal.addEventListener('abort',abort,{once:true});});
    const run=async()=>{
      try{
        try{sounds=new SystemCheckSounds();effects.current=sounds;sounds.configure(preferences.current.muted,preferences.current.volume);await sounds.resume();if(!live)return;sounds.activation();}catch{if(live)setError('Sound effects could not start. The checklist still works.');}
        const response=await fetch('/api/runtime/checks/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:request.signal});
        const result:Diagnostic=await consumeCheckStream(response,(next:Diagnostic)=>{if(live){latest=next;setReport(next);}},request.signal);
        await wait((reduced?1650:16500)-(performance.now()-started));if(!live)return;clock();clearInterval(timer);await completion;if(!live)return;
        showHudResponse(responseId,diagnosticAnnouncement(result));await waitForHudReveal(request.signal);
        if(preferences.current.announce){setSpeech('Preparing spoken report…');const r=await fetch('/api/runtime/voice/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assistant:'APEX',text:diagnosticAnnouncement(result)}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(120000)])});const data=await r.json();if(!r.ok)throw Error(data.error||'Fish Audio report failed.');if(!live)return;setSpeech('Announcing results…');const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));await audio.playFile(new File([bytes],'apex-system-check.mp3',{type:'audio/mpeg'}),true);if(live)setSpeech('Spoken report complete.');}
        if(live)callbacks.current.onPhase('idle');
      }catch(e){if(live){clearInterval(timer);sounds?.stopScan();setElapsed(16.5);setError(e instanceof Error?e.message:'System check failed.');setSpeech('');callbacks.current.onPhase('idle');}}finally{finishHudResponse(responseId);}
    };
    void run();
    return()=>{live=false;clearInterval(timer);window.removeEventListener('keydown',escape);request.abort();finishHudResponse(responseId);sounds?.close();effects.current=null;audio.stop();callbacks.current.onPhase('idle');};
  },[open]);
  if(!open)return null;
  const passed=report?.checks.filter(c=>c.state==='passed').length||0,failed=report?.checks.filter(c=>c.state==='failed').length||0,skipped=report?.checks.filter(c=>c.state!=='passed').length||0;
  const visible=report?.checks.slice(0,revealedCheckCount(elapsed,report.checks.length));
  return <div className={`apex-system-check check-stage-${stage}`}>
    {stage==='shockwave'&&<div className="check-shockwave"/>}
    {elapsed>=2.5&&elapsed<15.5&&<div className="check-scan-halos" aria-hidden="true"><i/><i/><i/></div>}
    {elapsed<3.5?<button className="check-early-close" aria-label="Close system check" onClick={onClose}><X size={18}/></button>:<section role="region" aria-labelledby="system-check-heading" className="check-console">
      <header><span>APEX / DIAGNOSTICS</span><button aria-label="Close system check" onClick={onClose}><X size={18}/></button><h2 id="system-check-heading">System check</h2><p aria-live="polite">{stage==='completed'?report?.summary:report?.state==='completed'?'Checks collected · HUD reconstruction animation':report?.checks.find(c=>c.state==='running')?.label||'Connecting to runtime…'}</p></header>
      <div className="check-audio-controls"><Volume2 size={14}/><label><input type="checkbox" checked={!muted} onChange={e=>setMuted(!e.target.checked)}/>Effects</label><input aria-label="System effects volume" type="range" min="0" max="1" step=".05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/><label><input type="checkbox" checked={announce} onChange={e=>setAnnounce(e.target.checked)}/>Fish voice report</label></div>
      <ol className="check-list">{visible?.map(c=><li key={c.id} data-state={c.state} title={c.detail}><span>{c.state==='passed'?<Check size={15}/>:c.state==='failed'?<AlertTriangle size={15}/>:c.state==='skipped'?<Minus size={15}/>:<LoaderCircle size={15}/>}</span><div><strong>{c.label}</strong><small>{c.detail}</small></div><b>{c.state==='running'?'CHECKING':c.state.toUpperCase()}</b></li>)}</ol>
      {error&&<p className="check-error" role="alert">{error}</p>}{speech&&<p className="check-speech" role="status">{speech}</p>}
      <footer><span>{passed} recorded passes · Animation timing is separate from diagnostics.</span><button onClick={onClose}>Close results</button></footer>
    </section>}
    {stage==='completed'&&<div className="check-completion-badge" role="status"><span>{checkOutcome(report)==='passed'?<Check size={30}/>:<AlertTriangle size={28}/>}</span><strong>SYSTEM CHECK</strong><small>{failed?`${failed} problems found`:skipped?`${passed} passed · ${skipped} unverified`:`${passed}/${report?.checks.length} passed`}</small></div>}
  </div>;
}
