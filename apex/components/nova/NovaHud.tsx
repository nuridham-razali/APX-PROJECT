"use client";

import dynamic from 'next/dynamic';

import {useCallback,useEffect,useRef,useState} from 'react';

import {ArrowUp,AudioLines,Check,MessageSquare,Mic,Pause,Play,Settings2,SlidersHorizontal,Square,Workflow,X} from 'lucide-react';

import LocationHud from '../LocationHud';

import HudWorkPanel from '../HudWorkPanel';

import {runtimeAction,type RuntimeState} from '../runtime-types';

import NovaWaveform from './NovaWaveform';

import HudParticleCore from '../HudParticleCore';

import {apexActivity} from './state-motion.mjs';

import {useNovaAudio} from './useNovaAudio';

import {useLocalVoice} from './useLocalVoice';
import {ContinuousVoice} from '../../lib/continuous-voice.mjs';

import {type NovaPhase,type NovaSignal} from './visual-config';

import './nova.css';



const Scene=dynamic(()=>import('./NovaScene'),{ssr:false});

const novaPersonality={sarcasm:0,roughness:0,directness:95,warmth:75,push:80};

type Message={role:'user'|'assistant';text:string};
type LoopView={enabled:boolean;status:string;error:string};

export default function NovaHud({onApex}:{onApex:()=>void}){

  const [phase,setPhase]=useState<NovaPhase>('idle'),[preview,setPreview]=useState(false),[panel,setPanel]=useState<'settings'|'chat'|'tasks'|'core'|null>(null);

  const [motion,setMotion]=useState(true),[effects,setEffects]=useState(true),[low,setLow]=useState(false),[visible,setVisible]=useState(true),[webglFailed,setWebglFailed]=useState(false);

  const signal=useRef<NovaSignal>({phase:'idle',inputLevel:0,outputLevel:0,preview:false});signal.current.phase=phase;signal.current.preview=preview;

  const [state,setState]=useState<RuntimeState|null>(null),[connected,setConnected]=useState(false),[connectionError,setConnectionError]=useState('Checking local service…');

  const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[chatError,setChatError]=useState('');

  const [greeting,setGreeting]=useState('Hello, Idham Razali.'),[language,setLanguage]=useState('English');

  const conversation=useRef(''),request=useRef<AbortController|null>(null),mounted=useRef(true),dialog=useRef<HTMLElement>(null),returnFocus=useRef<HTMLElement|null>(null);

  const coreVisual=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let frame=0;
    const update=(now:number)=>{
      const s=signal.current;
      const level=s.phase==='speaking'?(s.preview?Math.pow(.5+.5*Math.sin(now*.004),4):Math.min(1,s.outputLevel)):0;
      coreVisual.current?.style.setProperty('--nova-ring-pulse',String(.12+level*.88));
      if(motion&&visible)frame=requestAnimationFrame(update);
    };
    update(performance.now());return()=>cancelAnimationFrame(frame);
  },[motion,visible]);

  const audio=useNovaAudio(signal,p=>{setPreview(false);setPhase(p);});

  const localVoice=useLocalVoice(signal,p=>{setPreview(false);setPhase(p);},audio.playFile,'NOVA');

  const [readReplies,setReadReplies]=useState(true),[voiceReady,setVoiceReady]=useState(false),[speechReady,setSpeechReady]=useState(false),[correction,setCorrection]=useState(''),[teaching,setTeaching]=useState(false),[teachNotice,setTeachNotice]=useState('');

  const checkVoice=useCallback(async()=>{try{const r=await fetch('/api/runtime/voice/status',{cache:'no-store'});const v=await r.json();if(mounted.current){setVoiceReady(r.ok&&v.ready===true);setSpeechReady(r.ok&&v.nova?.ready===true);}}catch{if(mounted.current){setVoiceReady(false);setSpeechReady(false);}}},[]);
  useEffect(()=>{void checkVoice();},[checkVoice]);

  const [voiceLoop,setVoiceLoop]=useState<LoopView>({enabled:false,status:'off',error:''});
  const loop=useRef<ContinuousVoice|null>(null);
  const loopOps=useRef<{capture:(options:Parameters<typeof localVoice.start>[0])=>Promise<boolean>;transcribe:()=>Promise<string>;respond:(words:string)=>Promise<boolean>;announce:(words:string)=>Promise<boolean>;stopCapture:()=>void;stopOutput:()=>void;cancelTurn:()=>void}|null>(null);
  useEffect(()=>{const hidden=()=>{if(document.hidden&&loop.current?.enabled){loop.current.stop();setChatError('Voice conversation stopped while the HUD was hidden. Start it again when ready.');}};document.addEventListener('visibilitychange',hidden);return()=>{document.removeEventListener('visibilitychange',hidden);loop.current?.stop();};},[]);

  const knownTasks=useRef<Map<string,string>|null>(null),taskNotices=useRef<string[]>([]),announcedStages=useRef(new Set<string>());

  useEffect(()=>{

    if(!state)return;

    if(knownTasks.current){

      for(const task of state.tasks){

        const previous=knownTasks.current.get(task.id);

        const stage=task.state==='running'&&task.progress.startsWith('Checking')?'checking':task.state;
        const event=`${task.id}:${stage}`;
        if(task.assistant==='NOVA'&&previous&&['running','checking','completed','failed','awaiting_input','cancelled'].includes(stage)&&!announcedStages.current.has(event)){
          announcedStages.current.add(event);
          const title=task.request.slice(0,80).replace(/[.!?]+$/, '');
          const notice=stage==='running'?`I am going through your task: ${title}. You can keep talking.`:stage==='checking'?`I am checking the draft for your task: ${title}.`:stage==='completed'?`Your task is ready: ${title}. The saved result is in Tasks.`:stage==='awaiting_input'?`Your task needs your input or review: ${title}. Check Tasks for the details.`:stage==='cancelled'?`Your task was cancelled: ${title}.`:`Your task could not finish: ${title}. Check Tasks for the error.`;
          taskNotices.current.push(notice);
          loop.current?.queueAnnouncement(task.id,notice);
        }

      }

    }

    // Initial saved state is history, not a new task event to speak after reload.
    if(!knownTasks.current)for(const task of state.tasks){
      const stage=task.state==='running'&&task.progress.startsWith('Checking')?'checking':task.state;
      announcedStages.current.add(`${task.id}:${stage}`);
    }
    knownTasks.current=new Map(state.tasks.map(t=>[t.id,t.state]));

    if(!busy&&!audio.active&&taskNotices.current.length){const notices=taskNotices.current.splice(0);setMessages(v=>[...v,...notices.map(text=>({role:'assistant' as const,text}))]);}

  },[state,busy,audio.active]);

  useEffect(()=>{

    if(preview||busy||audio.active)return;

    const processing=Boolean(state?.activeTasks?.length);

    setPhase(current=>current==='idle'||current==='processing' ? processing?'processing':'idle' : current);

  },[state?.activeTasks?.length,preview,busy,audio.active]);

  const refresh=useCallback(async()=>{try{const res=await fetch('/api/runtime/state',{cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data.error);if(mounted.current){setState(data);setConnected(true);setConnectionError('');}}catch(e){if(mounted.current){setConnected(false);setConnectionError(e instanceof Error?e.message:'Local service unavailable.');}}},[]);

  useEffect(()=>{mounted.current=true;conversation.current=crypto.randomUUID();void refresh();const events=new EventSource('/api/runtime/events');events.onmessage=e=>{try{setState(JSON.parse(e.data));setConnected(true);setConnectionError('');}catch{}};events.onerror=()=>{setConnected(false);setConnectionError('Local service disconnected.');};const mq=matchMedia('(prefers-reduced-motion: reduce)');const reduce=()=>setMotion(!mq.matches);reduce();mq.addEventListener('change',reduce);const visibility=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',visibility);const tick=()=>{const hour=new Date().getHours();setGreeting(`Good ${hour<12?'morning':hour<18?'afternoon':'evening'}, Idham Razali.`);};tick();const timer=setInterval(tick,60000);setLow(innerWidth<700||navigator.hardwareConcurrency<=4);return()=>{mounted.current=false;events.close();request.current?.abort();mq.removeEventListener('change',reduce);document.removeEventListener('visibilitychange',visibility);clearInterval(timer);};},[refresh]);

  useEffect(()=>{if(!panel)return;returnFocus.current=document.activeElement as HTMLElement;const el=dialog.current;if(!el)return;const focusables=()=>Array.from(el.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')).filter(e=>!e.hasAttribute('disabled'));focusables()[0]?.focus();const trap=(e:KeyboardEvent)=>{if(e.key==='Escape'){setPanel(null);return;}if(e.key!=='Tab')return;const list=focusables();const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};el.addEventListener('keydown',trap);return()=>{el.removeEventListener('keydown',trap);returnFocus.current?.focus();};},[panel]);

  const stop=async()=>{loop.current?.stop();localVoice.stop();audio.stop();setPhase('idle');setPreview(false);signal.current.inputLevel=0;signal.current.outputLevel=0;if(busy){try{await runtimeAction('stop-chat',{conversationId:conversation.current});}catch(e){setChatError(e instanceof Error?e.message:'Request stop could not be confirmed.');}request.current?.abort();}setPhase('idle');};

  const testNovaVoice=async()=>{setChatError('');try{await localVoice.speak('Hello. Nova voice is connected and ready.',true);}catch(e){setChatError(e instanceof Error?e.message:'NOVA voice playback failed.');}};

  const send=async(spokenText?:string,waitForPlayback=false):Promise<boolean>=>{
    const text=(spokenText??draft).trim();if(!text||busy)return false;
    audio.stop();setPreview(false);setChatError('');setDraft('');setMessages(v=>[...v,{role:'user',text}]);setBusy(true);setPhase('thinking');
    const controller=new AbortController();request.current=controller;
    try{
      const res=await fetch('/api/runtime/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,conversationId:conversation.current,language,personality:novaPersonality,assistant:'NOVA'}),signal:controller.signal});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Request failed.');
      if(!mounted.current||controller.signal.aborted)return false;
      if(data.taskId&&knownTasks.current&&!knownTasks.current.has(data.taskId))knownTasks.current.set(data.taskId,'queued');
      setMessages(v=>[...v,{role:'assistant',text:data.message}]);
      if(readReplies&&speechReady&&language==='English'){
        try{await localVoice.speak(data.message,waitForPlayback);}
        catch(e){if(!controller.signal.aborted)setChatError('Reply saved, but NOVA speech failed. '+(e instanceof Error?e.message:''));return false;}
      }
      return !controller.signal.aborted;
    }catch(e){if(mounted.current&&!controller.signal.aborted)setChatError(e instanceof Error?e.message:'Request failed.');return false;}
    finally{if(mounted.current){setBusy(false);setPhase(current=>current==='speaking'?current:'idle');}if(request.current===controller)request.current=null;}
  };

  loopOps.current={capture:options=>localVoice.start(options),transcribe:()=>localVoice.finish(language),respond:words=>send(words,true),announce:async words=>{try{await localVoice.speak(words,true);return true;}catch(e){setChatError(e instanceof Error?e.message:'Task update speech failed.');return false;}},stopCapture:localVoice.stop,stopOutput:audio.stop,cancelTurn:()=>{const controller=request.current;if(controller&&!controller.signal.aborted){controller.abort();void runtimeAction('stop-chat',{conversationId:conversation.current}).catch(()=>{});}}};
  if(!loop.current)loop.current=new ContinuousVoice({capture:(options:Parameters<typeof localVoice.start>[0])=>loopOps.current!.capture(options),transcribe:()=>loopOps.current!.transcribe(),respond:(words:string)=>loopOps.current!.respond(words),announce:(words:string)=>loopOps.current!.announce(words),stopCapture:()=>loopOps.current!.stopCapture(),stopOutput:()=>loopOps.current!.stopOutput(),cancelTurn:()=>loopOps.current!.cancelTurn(),onChange:(value:LoopView)=>{if(mounted.current)setVoiceLoop(value);}});
  const startConversation=()=>{localVoice.stop();audio.stop();setPreview(false);setChatError('');setReadReplies(true);void loop.current!.start();};
  const loopLabels:Record<string,string>={starting:'Starting microphone…',listening:'Listening — pause when your request is complete.',transcribing:'Transcribing locally…',responding:'NOVA is answering. Microphone paused.',announcing:'NOVA is giving a task update. Microphone paused.',resuming:'Listening again shortly…',paused:'Voice conversation paused.',off:'Voice conversation off.'};
  const continuousControls=<><button className="nova-action" disabled={!voiceLoop.enabled&&(busy||localVoice.pending||localVoice.recording||!voiceReady||!speechReady||!state?.configured||language!=='English')} onClick={()=>voiceLoop.enabled?void stop():startConversation()}><Mic size={13}/>{voiceLoop.enabled?'Stop voice conversation':'Start voice conversation'}</button><p className="nova-muted" role="status">{loopLabels[voiceLoop.status]} {voiceLoop.enabled?'Background tasks continue independently.':'Microphone starts only when you choose Start. Say “stop listening” to end the session.'}</p>{voiceLoop.error&&<p className="nova-error" role="alert">{voiceLoop.error}</p>}</>;

  const selectPreview=(next:NovaPhase)=>{if(busy)return;audio.stop();setPreview(true);setPhase(next);signal.current.inputLevel=0;signal.current.outputLevel=0;};

  const active=voiceLoop.enabled||audio.active!==null||busy||localVoice.recording||localVoice.pending;const transcript=messages.filter(m=>m.role==='assistant').slice(-2);

  const toggleVoice=async()=>{if(localVoice.recording){const words=await localVoice.finish(language);if(words)await send(words);}else{audio.stop();await localVoice.start();}};

  const teach=async()=>{const original=messages.at(-1);if(original?.role!=='assistant')return;try{await runtimeAction('training',{conversationId:conversation.current,original:original.text,correction,assistant:'NOVA',language,model:state?.model});setCorrection('');setTeaching(false);setTeachNotice('Saved an approved example. Model weights have not changed.');void refresh();}catch(e){setTeachNotice(e instanceof Error?e.message:'Correction could not be saved.');}};

  const exportTraining=async()=>{try{const r=await fetch('/api/runtime/training/export');const v=await r.json();if(!r.ok)throw new Error(v.error);const url=URL.createObjectURL(new Blob([v.dataset],{type:'application/x-ndjson'}));const link=document.createElement('a');link.href=url;link.download='apex-approved-training.jsonl';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setTeachNotice(`Exported ${v.count} approved examples.`);}catch(e){setTeachNotice(e instanceof Error?e.message:'Export failed.');}};

  const canRender=!webglFailed;

  return <main className="nova-hud" data-phase={phase}>

    <h1 className="visually-hidden">NOVA personal assistant</h1>

    <div className="nova-space" aria-hidden="true">{canRender?<Scene signal={signal} motion={motion&&visible} effects={effects} low={low} onFail={()=>setWebglFailed(true)} />:<div className="nova-fallback"><i/><span/><span/></div>}</div>

    <div ref={coreVisual} className="nova-apex-core" data-core-state={apexActivity(phase)}><HudParticleCore persona="APEX" activity={apexActivity(phase)} motion={motion&&visible} particleColor="#ffffff" innerGlowColor="#9c4dff"/></div><div className="nova-vignette" aria-hidden="true" />

    <div className="nova-overview"><LocationHud connected={connected} activity={preview?'idle':phase} voiceStatus={audio.active==='microphone'?'Local meter':audio.active==='playback'?'Local audio':localVoice.recording?'Local Whisper':speechReady?'Fish voice configured':voiceReady?'Fish key needed':'Voice offline'} assistantName="NOVA"/></div>

    <button className={`nova-session ${active?'active':''}`} onClick={()=>active?void stop():setPanel('core')} aria-label={active?'Stop active session':'Open core and voice controls'}>{preview?'PREVIEW':active?'LIVE · TAP TO STOP':connected?'LOCAL · VOICE OFF':'DISCONNECTED'}<i/></button>

    <button className="nova-persona" onClick={()=>{void stop();onApex();}} aria-label="Switch to APEX">NOVA <span>/ APEX ↗</span></button>

    <section className="nova-transcript" aria-label="Assistant transcript" aria-live="polite">{transcript.map((m,i)=><p key={i} className={i===transcript.length-1?'current':''}>{m.text}</p>)}{chatError&&<p className="nova-error">{chatError}</p>}</section>

    <section className="nova-status" aria-label={`NOVA state: ${phase}${preview?' (animation preview)':''}`}><NovaWaveform signal={signal} motion={motion&&visible}/><span className="nova-status-ring"><i/></span><strong>{phase.toUpperCase()}</strong><div className="nova-status-dots"><i/><i/><i/></div>{preview&&<small>ANIMATION PREVIEW</small>}{audio.active==='microphone'&&<span className="nova-mic-marker" hidden><Mic size={10}/> LOCAL MICROPHONE METER</span>}</section>

    <nav className="nova-dock" aria-label="NOVA controls">{[{id:'settings',label:'Open NOVA settings',Icon:Settings2},{id:'chat',label:'Open NOVA chat',Icon:MessageSquare},{id:'tasks',label:'Open NOVA tasks',Icon:Workflow},{id:'core',label:'Open core appearance and preview controls',Icon:SlidersHorizontal}].map(({id,label,Icon})=><button key={id} aria-label={label} aria-pressed={panel===id} onClick={()=>setPanel(panel===id?null:id as typeof panel)}><Icon size={16} strokeWidth={1.2}/></button>)}</nav>

    {panel&&<><button className="nova-backdrop" aria-label="Close NOVA panel" onClick={()=>setPanel(null)}/><aside ref={dialog} className="nova-panel" role="dialog" aria-modal="true" aria-label={`NOVA ${panel}`}><header><span>NOVA / {panel.toUpperCase()}</span><button aria-label="Close NOVA panel" onClick={()=>setPanel(null)}><X size={17}/></button></header>

      {panel==='core'&&<><h2>Core & atmosphere</h2><p className="nova-muted">A little light. A little space.</p><label className="nova-setting">Animation<input type="checkbox" checked={motion} onChange={e=>setMotion(e.target.checked)}/></label><label className="nova-setting">Nebula & bloom<input type="checkbox" checked={effects} onChange={e=>setEffects(e.target.checked)}/></label><label className="nova-setting">Low-power rendering<input type="checkbox" checked={low} onChange={e=>setLow(e.target.checked)}/></label><div className="nova-section-label">ANIMATION PREVIEW</div><p className="nova-muted">Test a visual state. This does not start a voice session.</p><div className="nova-preview-grid">{(['idle','listening','processing','thinking','speaking'] as NovaPhase[]).map(p=><button key={p} disabled={active} aria-pressed={preview&&phase===p} onClick={()=>selectPreview(p)}>{p}</button>)}</div>{preview&&<button className="nova-action" onClick={()=>{setPreview(false);setPhase('idle');}}>End preview</button>}<div className="nova-section-label">NOVA VOICE</div><button className="nova-action" disabled={voiceLoop.enabled||busy||!speechReady} onClick={()=>void testNovaVoice()}>Test NOVA voice</button><p className="nova-muted">Start a voice conversation to send requests after a pause and listen again after each reply. Whisper and Qwen run locally; Fish speaks with your NOVA voice. The microphone pauses while NOVA answers. English voice replies are supported in this phase.</p><button className="nova-action" disabled={voiceLoop.enabled||busy||localVoice.pending||!voiceReady||!state?.configured} onClick={()=>void toggleVoice()}><Mic size={13}/>{localVoice.recording?'Finish voice request':'Speak to NOVA'}</button>{readReplies&&!speechReady&&<p className="nova-muted">NOVA voice is waiting for a Fish Audio API key. Text replies and local voice input still work.</p>}{continuousControls}{localVoice.pending&&<p className="nova-muted">Transcribing locally…</p>}{localVoice.error&&<p role="alert" className="nova-error">{localVoice.error}</p>}<div className="nova-section-label">REAL AUDIO RESPONSE</div><p className="nova-muted">The local microphone meter stays on this device. It does not transcribe speech. Choose an audio file to test actual playback amplitude.</p><button className="nova-action" disabled={voiceLoop.enabled||busy} onClick={()=>audio.active==='microphone'?audio.stop():void audio.startMic()}><Mic size={13}/>{audio.active==='microphone'?'Stop microphone meter':'Enable local microphone meter'}</button><label className="nova-file">Play a local audio file<input type="file" accept="audio/*" disabled={voiceLoop.enabled||busy} onChange={e=>{const file=e.target.files?.[0];if(file)void audio.playFile(file);e.target.value='';}}/></label>{audio.active&&<button className="nova-action" onClick={audio.stop}><Square size={12}/>Stop audio</button>}{audio.error&&<p role="alert" className="nova-error">{audio.error}</p>}{webglFailed&&<p className="nova-muted">WebGL unavailable. The static core fallback is active.</p>}</>}

      {panel==='settings'&&<><h2>Calm. Clear. NOVA.</h2><p className="nova-muted">Warm, honest, careful, and quietly proactive.</p><label className="nova-setting">Response language<select disabled={voiceLoop.enabled} value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Malay</option><option>中文</option></select></label><label className="nova-setting">Read replies aloud<input type="checkbox" checked={readReplies} disabled={voiceLoop.enabled} onChange={e=>setReadReplies(e.target.checked)}/></label><button className="nova-action" onClick={()=>void exportTraining()}>Export approved training examples</button>{teachNotice&&<p className="nova-muted">{teachNotice}</p>}<div className="nova-section-label">CONNECTIONS</div><p className="nova-muted">Local runtime: {connected?'connected':'disconnected'}<br/>AI brain: {state?.configured?`${state.provider||'local'} / ${state.model}`:'not configured'}<br/>Conversation priority: {state?.inference?.conversationPriority?'on':'not active'}<br/>Recognition: {voiceReady?'Local Whisper ready':'offline'}<br/>NOVA voice: {speechReady?'Fish Audio / free tier configured':'Fish Audio / API key needed'}<br/>Voice ID: 3a7bcde726774da88cef935fb2d64da3<br/>Approved training examples: {state?.trainingExamples||0}</p>{connectionError&&<p className="nova-muted">{connectionError}</p>}<button className="nova-action" onClick={()=>{void refresh();void checkVoice();}}>Check local service</button><p className="nova-muted">Whisper recognizes speech locally. NOVA reply text goes to Fish Audio for speech. Add FISH_API_KEY privately in .env.local, then restart the runtime. Sending messages still requires your confirmation.</p></>}

      {panel==='chat'&&<><h2>What’s your next priority?</h2><p className="nova-muted">{state?.configured?'Say “Draft…” or “Review…” to start a background task. Ask “How is it going?” or give me another task while it runs.':'Check the configured brain and start the APEX runtime to enable replies.'}</p><div className="nova-chat-history">{messages.length?messages.map((m,i)=><p key={i} data-role={m.role}><small>{m.role==='user'?'YOU':'NOVA'}</small>{m.text}</p>):<p className="nova-muted">Your conversation will appear here.</p>}</div><button className="nova-action" disabled={voiceLoop.enabled||busy||localVoice.pending||!voiceReady||!state?.configured} onClick={()=>void toggleVoice()}><Mic size={13}/>{localVoice.recording?'Finish voice request':'Speak to NOVA'}</button>{continuousControls}{localVoice.pending&&<p className="nova-muted">Transcribing locally…</p>}{localVoice.error&&<p role="alert" className="nova-error">{localVoice.error}</p>}<form onSubmit={e=>{e.preventDefault();if(voiceLoop.enabled)void stop();void send();}}><label className="visually-hidden" htmlFor="nova-message">Message NOVA</label><div className="nova-input"><textarea id="nova-message" value={draft} onChange={e=>{if(voiceLoop.enabled)void stop();setDraft(e.target.value);}} placeholder="Message NOVA…" rows={2}/><button aria-label="Send message to NOVA" disabled={busy||!draft.trim()||!connected||!state?.configured}><ArrowUp size={16}/></button></div></form>{busy&&<button className="nova-action" onClick={()=>void stop()}>Stop request</button>}{messages.at(-1)?.role==='assistant'&&!busy&&<button className="nova-action" onClick={()=>{setTeaching(!teaching);setCorrection(messages.at(-1)?.text||'');}}>Teach NOVA: correct the last reply</button>}{teaching&&<div><label className="nova-muted" htmlFor="nova-correction">Your corrected answer (saved only when you approve)</label><textarea id="nova-correction" value={correction} onChange={e=>setCorrection(e.target.value)} rows={5} style={{width:'100%'}}/><button className="nova-action" disabled={!correction.trim()} onClick={()=>void teach()}>Save approved training example</button></div>}{teachNotice&&<p className="nova-muted">{teachNotice}</p>}{chatError&&<p role="alert" className="nova-error">{chatError}</p>}</>}

      {panel==='tasks'&&<><h2>Work in the background.</h2><p className="nova-muted">Plan, execute, check, and report. Conversation stays available.</p><HudWorkPanel mode="tasks" assistant="NOVA" language={language}/></>}

    </aside></>}

  </main>;

}










