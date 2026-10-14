"use client";
import { useEffect, useRef, useState, type RefObject } from 'react';
import { runtimeAction, type RuntimeState } from './runtime-types';
import './hud-work-panel.css';
import {useNovaAudio} from './nova/useNovaAudio';
import {useLocalVoice} from './nova/useLocalVoice';
import {streamConversation,SpeechQueue} from '../lib/realtime-conversation.mjs';
import {showHudResponse,showHudUserTranscript,finishHudResponse,exactSpeechChunks,waitForHudReveal} from '../lib/hud-response.mjs';
import {requestPhase} from '../lib/assistant-activity.mjs';
import {parseLoopCommand} from '../lib/loops-config.mjs';
import {parsePersonalityCommand} from '../lib/personality.mjs';
import {isSystemCheckCommand} from '../lib/system-check.mjs';
import {useApexVoice} from './useApexVoice';
import {BrowserVoiceSession,BROWSER_VOICE_EVENT,BROWSER_VOICE_COMMAND} from '../lib/browser-voice-session.mjs';
import {extractApexWake,APEX_WAKE_REPLY} from '../lib/wake-phrase.mjs';
import {VOICE_INDICATOR_EVENT} from '../lib/voice-indicator.mjs';
import {spokenText} from '../lib/spoken-text.mjs';
import type {NovaSignal,NovaPhase} from './nova/visual-config';

const isHumanoidCommand=(text:string)=>/^(?:please\s+)?(?:apex[\s,]+)?(?:can\s+you\s+)?(?:show\s+(?:me\s+)?(?:your\s+)?(?:face|phase)|open\s+(?:the\s+|your\s+)?(?:humanoid|human)(?:\s+(?:view|form|mode|face))?|show\s+(?:the\s+|your\s+)?(?:humanoid|human)(?:\s+(?:view|form|mode|face))?|switch\s+to\s+(?:the\s+)?(?:humanoid|human)(?:\s+(?:view|form|mode|face))?|go\s+to\s+(?:the\s+)?(?:humanoid|human)(?:\s+(?:view|form|mode|face))?)(?:\s+please)?\s*[.!?]*$/i.test(text.trim());

export default function HudWorkPanel({ mode, assistant = 'APEX', language = 'English',onVoicePhase,voiceSignal,onSystemCheck,onRequestActive,onOpenHumanoid }: { mode: 'tasks' | 'chat'; assistant?: 'APEX' | 'NOVA'; language?: string;onVoicePhase?:(phase:NovaPhase)=>void;voiceSignal?:RefObject<NovaSignal>;onSystemCheck?:()=>void;onRequestActive?:(active:boolean)=>void;onOpenHumanoid?:()=>void }) {
  const [state, setState] = useState<RuntimeState|null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [connectionError,setConnectionError]=useState('');
  const [goal, setGoal] = useState(''), [source, setSource] = useState(''), [notice, setNotice] = useState('');
  const [messages, setMessages] = useState<{role:string;text:string;id?:string;status?:string}[]>([]);
  const conversation = useRef(''), mounted = useRef(true);
  const ownSignal=useRef<NovaSignal>({phase:'idle',inputLevel:0,outputLevel:0,preview:false});
  const signal=voiceSignal||ownSignal;
  const requestPending=useRef(false),pendingCount=useRef(0);
  const realtime=useRef<{controller:AbortController;id:string}|null>(null),speechStart=useRef<()=>void>(()=>{}),wakeDetected=useRef<()=>void>(()=>{});
  const [turnStatus,setTurnStatus]=useState('');
  const toggleVoiceRef=useRef<()=>void>(()=>{}),stopSessionRef=useRef<()=>void>(()=>{});
  const wakeReply=useRef<(abort?:AbortSignal)=>Promise<void>>(async()=>{});
  const browser=useRef<BrowserVoiceSession|null>(null),browserSubmit=useRef<(text:string,abort:AbortSignal)=>Promise<void>>(async()=>{});
  const voiceMode='deepgram' as const;
  const [browserState,setBrowserState]=useState({state:'OFF',microphoneEnabled:false,handsFree:true,draft:'',editing:false,message:'',pendingConsent:false});
  const browserMode=false;
  const requestCallback=useRef(onRequestActive);requestCallback.current=onRequestActive;
  const beginRequest=()=>{pendingCount.current++;requestPending.current=true;requestCallback.current?.(true);phase('thinking');};
  const endRequest=()=>{pendingCount.current=Math.max(0,pendingCount.current-1);requestPending.current=pendingCount.current>0;requestCallback.current?.(requestPending.current);if(signal.current.phase!=='speaking')phase('idle');};
  useEffect(()=>()=>{requestCallback.current?.(false);},[]);
  const phase=(value:NovaPhase)=>{const next=requestPhase(value,requestPending.current) as NovaPhase;signal.current.phase=next;onVoicePhase?.(next);if(next==='speaking'){setTurnStatus('Speaking…');if(browser.current?.state!=='SPEAKING')browser.current?.playing();}};
  const sendVoice=useRef<(words:string)=>void>(()=>{}),continuous=useRef(false),voiceRevision=useRef(0);
  const audio=useNovaAudio(signal,phase),localVoice=useLocalVoice(signal,phase,audio.playFile,'NOVA'),apexVoice=useApexVoice(signal,phase,audio.playFile,words=>sendVoice.current(words),()=>speechStart.current(),()=>wakeDetected.current());
  const voice=assistant==='APEX'?apexVoice:localVoice;
  const playApex=async(file:File,onStarted?:()=>void)=>{apexVoice.pauseCapture();try{await audio.playFile(file,true,onStarted);}finally{if(continuous.current&&mounted.current)apexVoice.resumeCapture();}};
  const [readReplies,setReadReplies]=useState(true),[voiceReady,setVoiceReady]=useState(false),[speechReady,setSpeechReady]=useState(false);
  const checkVoice=async()=>{try{const r=await fetch('/api/runtime/voice/status',{cache:'no-store'});const v=await r.json();if(mounted.current){setVoiceReady(assistant==='APEX'?v.apex?.ready===true:v.ready===true);setSpeechReady(assistant==='APEX'?v.apex?.speechReady===true:v.nova?.ready===true);}}catch{setVoiceReady(false);setSpeechReady(false);}};
  useEffect(()=>{void checkVoice();return()=>{continuous.current=false;onVoicePhase?.('idle');};},[assistant]);
  useEffect(()=>{if(mode!=='chat'||assistant!=='APEX')return;window.dispatchEvent(new CustomEvent('apex-hud-voice-status',{detail:{mode:voiceMode,active:browserMode?browserState.microphoneEnabled:voice.recording||voice.pending,ready:browserMode?true:voiceReady&&state?.configured===true,busy,playing:audio.active==='playback',error:voice.error||'',captureState:browserMode?browserState.state:voice.recording&&signal.current.phase==='listening'?'LISTENING':voice.pending?'STARTING':'PAUSED'}}));window.dispatchEvent(new CustomEvent(BROWSER_VOICE_EVENT,{detail:{mode:voiceMode,voice:browser.current?.snapshot()||browserState}}));},[mode,assistant,voiceMode,browserState,voice.recording,voice.pending,voice.error,voiceReady,state?.configured,busy,audio.active]);
  useEffect(()=>{if(mode!=='chat'||assistant!=='APEX')return;const toggle=()=>toggleVoiceRef.current();const stop=()=>stopSessionRef.current();window.addEventListener('apex-hud-toggle-voice',toggle);window.addEventListener('apex-stop-session',stop);return()=>{window.removeEventListener('apex-hud-toggle-voice',toggle);window.removeEventListener('apex-stop-session',stop);};},[mode,assistant]);
  const refresh = async () => { const res = await fetch('/api/runtime/state',{cache:'no-store'}); const data = await res.json(); if(!res.ok)throw new Error(data.error); if(mounted.current)setState(data); };
  useEffect(() => {
    mounted.current=true;const key='apex.conversation.'+assistant;
    try{conversation.current=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,conversation.current);}catch{conversation.current=crypto.randomUUID();}
    const restoring=conversation.current;
    void runtimeAction('conversation',{conversationId:restoring}).then(saved=>{if(mounted.current&&conversation.current===restoring)setMessages(items=>items.length?items:(saved.contents||[]).map((m:{role:string;parts:{text:string}[]})=>({role:m.role==='user'?'You':assistant,text:m.parts.map(p=>p.text||'').join('')})));}).catch(()=>{});
    void refresh().catch(()=>setError('Local service unavailable.'));
    const events=new EventSource('/api/runtime/events');
    events.onmessage=e=>{try{setState(JSON.parse(e.data));setConnectionError('');}catch{}};
    events.onerror=()=>setConnectionError('Local service disconnected.');
    return()=>{mounted.current=false;events.close();};
  },[]);
  const action = async (path:string,body:object) => { setError(''); try { const result=await runtimeAction(path,body);await refresh();return result; } catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Request failed.');return null;} };
  const interruptRealtime=(listening=false)=>{
    const turn=realtime.current;realtime.current=null;
    if(turn){turn.controller.abort(new DOMException('Reply interrupted.','AbortError'));finishHudResponse(turn.id);endRequest();setBusy(false);setMessages(items=>items.map(m=>m.id===turn.id?{...m,status:'Interrupted'}:m));}
    audio.stop();if(listening)phase('listening');
  };
  useEffect(()=>{
    if(mode!=='chat'||assistant!=='APEX')return;
    const controller=new BrowserVoiceSession({onWake:(abort:AbortSignal)=>wakeReply.current(abort),submit:(text:string,abort:AbortSignal)=>browserSubmit.current(text,abort),stopOutput:()=>{apexVoice.stop();interruptRealtime();},active:()=>!document.hidden,onChange:(value:typeof browserState)=>{if(!mounted.current)return;setBrowserState(value);if(value.microphoneEnabled){try{localStorage.setItem('apex.voice.autostart','true');}catch{}}if(value.draft)showHudUserTranscript(value.draft);else if(['OFF','ERROR','PAUSED'].includes(value.state))finishHudResponse('apex-user-voice');window.dispatchEvent(new CustomEvent(BROWSER_VOICE_EVENT,{detail:{voice:value}}));if(value.state==='LISTENING')phase('listening');else if(['SENDING','WAITING'].includes(value.state))phase('thinking');else if(['OFF','IDLE','PAUSED','ERROR'].includes(value.state)&&signal.current.phase!=='speaking')phase('idle');}});browser.current=controller;
    const command=(event:Event)=>{const {action,value}=(event as CustomEvent).detail||{};if(action==='input')return;else if(action==='continue')controller.continueUnknown();else if(action==='off')controller.off();else if(action==='pause')controller.pause('Microphone paused.');else if(action==='edit')controller.edit(value);else if(action==='cancel')controller.cancelDraft();else if(action==='send')void controller.send();else if(action==='resume'){window.dispatchEvent(new CustomEvent(VOICE_INDICATOR_EVENT,{detail:{action:'reveal',reason:'manual'}}));controller.resume();}else if(action==='stop')controller.stop();else if(action==='handsFree')controller.setHandsFree(value);};
    const visibility=()=>{if(document.hidden)controller.pause('Microphone paused.');};const leave=()=>controller.off();
    window.addEventListener(BROWSER_VOICE_COMMAND,command);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);
    // Browser recognition is retained only for backwards compatibility with
    // old sessions; APEX voice input is now Deepgram Flux exclusively.
    continuous.current=true;
    void apexVoice.start();
    return()=>{window.removeEventListener(BROWSER_VOICE_COMMAND,command);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);controller.dispose();browser.current=null;};
  },[mode,assistant]);
  speechStart.current=()=>{interruptRealtime();};
  wakeDetected.current=()=>{phase('listening');setTurnStatus('Listening…');};
  useEffect(()=>()=>{realtime.current?.controller.abort();},[]);
  useEffect(()=>{if(apexVoice.error&&assistant==='APEX')setTurnStatus(apexVoice.error);},[apexVoice.error]);
  const streamTurn=async(input:string,ownerSignal?:AbortSignal)=>{
    if(!input.trim())return;ownerSignal?.throwIfAborted();
    if(assistant==='APEX'&&isHumanoidCommand(input)){onOpenHumanoid?.();setGoal('');setTurnStatus('Humanoid view open.');return;}
    if(!ownerSignal&&browser.current?.microphoneEnabled)browser.current.pause('Microphone paused while you type.');
    interruptRealtime();const turn={id:crypto.randomUUID(),controller:new AbortController()};realtime.current=turn;
    const ownerAbort=()=>{if(realtime.current===turn)interruptRealtime();else turn.controller.abort();};ownerSignal?.addEventListener('abort',ownerAbort,{once:true});
    const request=turn.controller,started=performance.now();let firstText=0,firstAudio=0,speechError:Error|null=null,replyReceived=false;
    let responseText='',revealed=false;
    const revealReply=()=>{if(!current()||revealed)return;revealed=true;setMessages(items=>items.map(m=>m.id===turn.id?{...m,text:responseText}:m));};
    setError('');setGoal('');setBusy(true);beginRequest();setTurnStatus('Thinking…');
    setMessages(items=>[...items,{role:'You',text:input},{id:turn.id,role:assistant,text:''}]);
    const current=()=>mounted.current&&realtime.current===turn&&!request.signal.aborted;
    const speech=new SpeechQueue({signal:request.signal,prepare:(text:string,abort:AbortSignal)=>apexVoice.prepare(text,abort),play:async(file:File)=>{if(!current())return;setTurnStatus('Preparing playback…');await playApex(file,()=>{if(!firstAudio)firstAudio=performance.now()-started;revealReply();});},onError:(e:Error)=>{if(!request.signal.aborted){speechError=e;setError(e.message);}}});
    try{
      const reply=await streamConversation({message:input,conversationId:conversation.current,assistant,language},{signal:request.signal,onText:(delta:string,full:string)=>{
        if(!current())return;if(!firstText)firstText=performance.now()-started;
        if(!readReplies||language!=='English')setMessages(items=>items.map(m=>m.id===turn.id?{...m,text:spokenText(full)}:m));
      }});
      if(!current())return;replyReceived=true;
      responseText=spokenText(reply.message);
      if(reply.personality)window.dispatchEvent(new CustomEvent('apex-personality-updated',{detail:reply.personality}));
      if(readReplies&&language==='English'){for(const chunk of exactSpeechChunks(responseText))speech.add(chunk);await speech.finish();}else revealReply();
      if(current())setTurnStatus(`First text ${(firstText/1000).toFixed(1)}s${firstAudio?` · First audio ${(firstAudio/1000).toFixed(1)}s`:''}`);
    }catch(e){
      if(mounted.current&&realtime.current===turn){
        const failure=speechError||(e instanceof Error?e:new Error('Conversation failed.'));
        if(replyReceived&&speechError)revealReply();
        if(failure.name!=='AbortError'){setError(failure.message);setMessages(items=>items.map(m=>m.id===turn.id?{...m,status:replyReceived&&speechError?'Voice unavailable':'Failed'}:m));setTurnStatus('Reply failed · microphone stays enabled.');}
      }
      request.abort();if(realtime.current===turn)audio.stop();
      if(ownerSignal){const failure=e instanceof Error?e:new Error('Request failed.');Object.assign(failure,{voiceStage:speechError?'audio':'ai'});throw failure;}
    }finally{
      finishHudResponse(turn.id);
      ownerSignal?.removeEventListener('abort',ownerAbort);
      if(realtime.current===turn){realtime.current=null;endRequest();if(mounted.current){setBusy(false);phase('idle');}}
    }
  };
  browserSubmit.current=(text,abort)=>streamTurn(text,abort);
  const submit = async (spokenText?:string) => {
    const input=(spokenText??goal).trim();
    if(assistant==='APEX'&&isHumanoidCommand(input)){onOpenHumanoid?.();setGoal('');setTurnStatus('Humanoid view open.');return;}
    if(mode==='chat'&&onSystemCheck&&isSystemCheckCommand(input)){browser.current?.pause('Microphone paused during system check.');continuous.current=false;voiceRevision.current++;interruptRealtime();voice.stop();audio.stop();onSystemCheck();return;}
    if(mode==='chat'&&assistant==='APEX'&&input){await streamTurn(input);return;}
    if(mode==='chat'&&assistant==='APEX'&&(parsePersonalityCommand(input)||parseLoopCommand(input))){
      setGoal('');setMessages(v=>[...v,{role:'You',text:input}]);
      beginRequest();
      try{const reply=await action('chat',{message:input,conversationId:conversation.current,assistant,language});
      if(reply&&mounted.current){setMessages(v=>[...v,{role:assistant,text:reply.message}]);if(reply.personality)window.dispatchEvent(new CustomEvent('apex-personality-updated',{detail:reply.personality}));const id=crypto.randomUUID();showHudResponse(id,reply.message);try{if(readReplies&&!busy&&signal.current.phase!=='speaking'){await waitForHudReveal(new AbortController().signal);await voice.speak(reply.message,true);}}catch(e){setError(e instanceof Error?e.message:'Speech failed.');}finally{finishHudResponse(id);}}
      }finally{endRequest();}
      return;
    }
    if(busy||!input)return;const revision=voiceRevision.current;beginRequest();audio.stop();setBusy(true);setNotice('');phase('thinking');
    try {
      if(mode==='tasks'){
        const task=await action('tasks',{message:input,source,mode:assistant==='APEX'?'agents':'closed_loop',assistant,language});
        if(task&&mounted.current){setGoal('');setSource('');setNotice(`Task ${task.id.slice(0,8)} queued. You can keep talking.`);}
      }else{
        const text=input;setGoal('');setMessages(v=>[...v,{role:'You',text}]);
        const reply=await action('chat',{message:text,conversationId:conversation.current,assistant,language});
        if(!reply)continuous.current=false;
        if(reply&&mounted.current){setMessages(v=>[...v,{role:assistant,text:reply.message}]);if(readReplies&&language==='English'&&voiceRevision.current===revision)try{await voice.speak(reply.message,true);}catch(e){continuous.current=false;setError(e instanceof Error?e.message:'Speech failed.');}}
      }
    }finally{endRequest();if(mounted.current)setBusy(false);}
  };
  const noticePlayback=useRef(false),seenNotices=useRef(new Set<string>());
  useEffect(()=>{
    if(mode!=='chat'||assistant!=='APEX'||busy||noticePlayback.current||document.hidden||voice.recording||voice.pending)return;
    if(browserMode&&browserState.microphoneEnabled&&(browserState.state!=='LISTENING'||browserState.draft||!browserState.handsFree))return;
    const n=state?.taskNotifications?.find(n=>n.conversationId===conversation.current&&!seenNotices.current.has(n.id));if(!n)return;
    noticePlayback.current=true;
    const deliver=async(abort:AbortSignal)=>{
      const turn={id:n.id,controller:new AbortController()};realtime.current=turn;
      const cancelled=()=>turn.controller.abort(abort.reason);abort.addEventListener('abort',cancelled,{once:true});
      setBusy(true);
      try{
        const receipt=await runtimeAction('task-notifications',{id:n.id,conversationId:conversation.current});
        seenNotices.current.add(n.id);if(abort.aborted||turn.controller.signal.aborted||!mounted.current||realtime.current!==turn)return;
        const text=spokenText(receipt.text);let revealed=false;const reveal=()=>{if(revealed||turn.controller.signal.aborted||realtime.current!==turn)return;revealed=true;setMessages(items=>[...items,{id:n.id,role:assistant,text}]);};
        if(readReplies&&speechReady&&language==='English'){
          const queue=new SpeechQueue({signal:turn.controller.signal,prepare:(text:string,signal:AbortSignal)=>apexVoice.prepare(text,signal),play:(file:File)=>playApex(file,reveal)});
          try{for(const chunk of exactSpeechChunks(text))queue.add(chunk);await queue.finish();}catch(error){reveal();throw error;}
        }else reveal();
      }finally{finishHudResponse(n.id);abort.removeEventListener('abort',cancelled);if(realtime.current===turn){realtime.current=null;setBusy(false);setTurnStatus('Task update delivered.');phase('idle');}}
    };
    void (async()=>{
      try{if(browserMode&&browserState.microphoneEnabled&&browser.current)await browser.current.announce(deliver);else await deliver(new AbortController().signal);}
      catch(e){seenNotices.current.add(n.id);if(mounted.current&&!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Task result is saved, but its announcement failed.');}
      finally{noticePlayback.current=false;}
    })();
  },[state,mode,assistant,busy,browserMode,browserState,voice.recording,voice.pending,readReplies,speechReady,language]);
  useEffect(()=>{
    if(mode!=='chat'||assistant!=='APEX'||!speechReady||busy||browserState.microphoneEnabled||voice.recording||voice.pending||signal.current.phase!=='idle'||noticePlayback.current||document.hidden)return;
    const n=state?.loopNotifications?.find(n=>n.spoken&&!n.audioClaimed&&!n.deferred&&!n.dismissed&&!seenNotices.current.has(n.id));if(!n)return;
    seenNotices.current.add(n.id);noticePlayback.current=true;const revision=voiceRevision.current;
    void (async()=>{let claimed=false;const id=crypto.randomUUID();try{await runtimeAction('loops/notifications',{id:n.id,action:'claim'});claimed=true;if(voiceRevision.current!==revision||signal.current.phase!=='idle')throw new Error('Spoken update skipped during another interaction; text remains in Loops.');showHudResponse(id,n.text);await waitForHudReveal(new AbortController().signal);await voice.speak(n.text,true);await runtimeAction('loops/notifications',{id:n.id,action:'played'});}catch(e){if(claimed){await runtimeAction('loops/notifications',{id:n.id,action:'played',error:true}).catch(()=>{});if(mounted.current)setError(e instanceof Error?e.message:'Spoken loop update failed; saved text remains available.');}}finally{finishHudResponse(id);noticePlayback.current=false;}})();
  },[state,mode,assistant,speechReady,busy,browserState.microphoneEnabled,voice.recording,voice.pending]);
  wakeReply.current=async(ownerSignal?:AbortSignal)=>{
    ownerSignal?.throwIfAborted();if(!mounted.current)return;
    interruptRealtime();const turn={id:crypto.randomUUID(),controller:new AbortController()};realtime.current=turn;
    const cancel=()=>{if(realtime.current===turn)interruptRealtime();else turn.controller.abort();};ownerSignal?.addEventListener('abort',cancel,{once:true});
    apexVoice.pauseCapture();setBusy(true);setError('');
    try{
      if(!readReplies){setTurnStatus(APEX_WAKE_REPLY);return;}
      const file=await apexVoice.prepare(APEX_WAKE_REPLY,turn.controller.signal);
      turn.controller.signal.throwIfAborted();if(realtime.current!==turn||!mounted.current)return;
      await playApex(file,()=>setTurnStatus(APEX_WAKE_REPLY));
    }catch(error){if(error instanceof Error&&error.name!=='AbortError'&&mounted.current)setError(error.message);throw error;}
    finally{ownerSignal?.removeEventListener('abort',cancel);if(realtime.current===turn){realtime.current=null;setBusy(false);if(continuous.current&&mounted.current)apexVoice.resumeCapture();}}
  };
  sendVoice.current=words=>{
    const wake=extractApexWake(words);if(wake.called)window.dispatchEvent(new CustomEvent(VOICE_INDICATOR_EVENT,{detail:{action:'reveal'}}));words=wake.message;if(!words){if(wake.called)void wakeReply.current().catch(()=>{});return;}
    if(/^(?:apex[, ]+)?(?:stop|stop talking|stop listening|stop voice session|goodbye)[.!?]*$/i.test(words.trim())){continuous.current=false;interruptRealtime();apexVoice.stop();setTurnStatus('Voice session stopped.');return;}
    if(isSystemCheckCommand(words)&&onSystemCheck){continuous.current=false;interruptRealtime();apexVoice.stop();onSystemCheck();return;}
    void streamTurn(words);
  };
  const toggleVoice=async()=>{
    if(!(browserMode?browser.current?.microphoneEnabled:voice.recording||voice.pending))window.dispatchEvent(new CustomEvent(VOICE_INDICATOR_EVENT,{detail:{action:'reveal',reason:'manual'}}));
    if(browserMode){if(browser.current?.microphoneEnabled||browser.current?.pendingConsent)browser.current.off();else await browser.current?.enable();return;}
    if(voice.pending)return;
    if(voice.recording){
      if(assistant==='NOVA'&&voice.recording){const words=await voice.finish(language);if(words)await submit(words);return;}
      continuous.current=false;voiceRevision.current++;interruptRealtime();voice.stop();setTurnStatus('Voice session stopped.');
    }else{interruptRealtime();continuous.current=assistant==='APEX';if(await voice.start()){try{localStorage.setItem('apex.voice.autostart','true');}catch{}setTurnStatus('Idle · say Apex to speak.');}}
  };
  const testVoice=async()=>{browser.current?.pause('Microphone paused during voice test.');continuous.current=false;voice.stop();setError('');try{await voice.speak(`Hello. ${assistant} voice is connected and ready.`,true);}catch(e){setError(e instanceof Error?e.message:'Speech test failed.');}};
  toggleVoiceRef.current=()=>{void toggleVoice();};
  stopSessionRef.current=()=>{continuous.current=false;voiceRevision.current++;if(browserMode)browser.current?.off();else{interruptRealtime();voice.stop();audio.stop();}setTurnStatus('Voice session stopped. Background tasks continue.');};
  return <div className="hud-work-content">
    <h2>{mode==='tasks'?'What shall I work on?':'Let’s talk.'}</h2>
    <p className="hud-work-muted">{mode==='tasks'?'Plan, work, check. I’ll keep you updated.':'Conversation stays available while tasks run.'}</p>
    {mode==='chat'&&<div className="hud-work-messages" aria-live="polite">{messages.map((m,i)=><p key={i}><small>{m.role}</small>{m.text}{m.status&&<em> · {m.status}</em>}</p>)}</div>}
    {mode==='chat'&&assistant==='APEX'&&<button onClick={()=>{browser.current?.off();continuous.current=false;voice.stop();interruptRealtime();conversation.current=crypto.randomUUID();try{localStorage.setItem('apex.conversation.'+assistant,conversation.current);}catch{}setMessages([]);setGoal('');setTurnStatus('');}}>New conversation</button>}
    {mode==='chat'&&<><p className="hud-work-muted">{assistant==='APEX'?(browserMode?'Optional browser recognition. Its processing destination is checked before MIC ON. Replies: Fish Audio.':'Speech recognition: Deepgram Flux English. Replies: Fish Audio. Microphone audio goes to Deepgram; reply text goes to Fish Audio.'):'Local Whisper recognition; Fish Audio replies.'}</p><button disabled={!browserMode&&!voice.recording&&!voice.pending&&(busy||!voiceReady||!state?.configured||language!=='English')} onClick={()=>void toggleVoice()}>{voice.recording||voice.pending?'Stop microphone':`Speak to ${assistant}`}</button><button disabled={busy||voice.recording||voice.pending||!speechReady} onClick={()=>void testVoice()}>Test {assistant} voice</button><button onClick={()=>void checkVoice()}>Check voice connection</button><label><input type="checkbox" checked={readReplies} onChange={e=>setReadReplies(e.target.checked)}/> Read replies aloud</label>{assistant==='APEX'&&apexVoice.transcript&&<p role="status">{apexVoice.transcript}</p>}{voice.pending&&<p>Connecting to speech recognition…</p>}{!browserMode&&!voiceReady&&<p className="hud-work-muted">{assistant==='APEX'?'Add DEEPGRAM_API_KEY privately and restart the runtime.':'Local recognition is unavailable.'}</p>}{!speechReady&&<p className="hud-work-muted">{assistant==='APEX'?'Add FISH_API_KEY and APEX_FISH_VOICE_ID privately and restart the runtime.':'Fish Audio key is needed.'}</p>}{voice.error&&<p role="alert">{voice.error}</p>}{audio.error&&<p role="alert">{audio.error}</p>}<button onClick={()=>{if(browserMode){browser.current?.stop();return;}continuous.current=false;voiceRevision.current++;interruptRealtime();voice.stop();audio.stop();setTurnStatus('Voice session stopped.');}}>Stop voice session</button></>}
    {mode==='chat'&&assistant==='APEX'&&turnStatus&&<p className="hud-work-muted" role="status">{turnStatus}</p>}
    {mode==='chat'&&assistant==='APEX'&&<p className="hud-work-muted">Continuous voice stays on until stopped (up to five minutes per session). Headphones help prevent speaker echo.</p>}
    <form onSubmit={e=>{e.preventDefault();void submit();}}>
      {mode==='chat'&&<button type="button" onClick={()=>{setGoal('');if(browserMode)browser.current?.cancelDraft();else interruptRealtime();}}>Cancel</button>}
      <label>{mode==='tasks'?'Your goal':'Message'}<textarea rows={3} maxLength={16000} value={goal} onChange={e=>{setGoal(e.target.value);}} placeholder={mode==='tasks'?'Describe the result you need…':`Message ${assistant}…`}/></label>
      {mode==='tasks'&&<details><summary>Add source material</summary><label><span className="visually-hidden">Source material</span><textarea rows={4} maxLength={40000} value={source} onChange={e=>setSource(e.target.value)} placeholder="Paste notes or text to work from…"/></label></details>}
      <button className="hud-work-primary" disabled={!goal.trim()||(((busy&&!(mode==='chat'&&assistant==='APEX'))||!state?.configured)&&!(assistant==='APEX'&&(parsePersonalityCommand(goal)||parseLoopCommand(goal))))}>{busy?'Working…':mode==='tasks'?'Start task':'Send'}</button>
    </form>
    {!state?.configured&&<p className="hud-work-muted">{state?'Check the configured brain and start the APEX runtime.':'Connecting to local service…'}</p>}
    {connectionError&&<p role="alert">{connectionError}</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="hud-work-error">{error}</p>}
    {mode==='tasks'&&<div className="hud-work-list">{state?.tasks.slice(0,8).map(task=><article key={task.id}>
      <strong>{task.request}</strong><p className="hud-work-muted">{task.status||task.state.replaceAll('_',' ')} · {task.progress}</p>
      {task.error&&<p className="hud-work-error">{task.error}</p>}
      {task.result&&<details><summary>View result</summary><pre>{task.result}</pre></details>}
      {task.steps.some(s=>s.checks?.length)&&<details><summary>Result checks</summary><p className="hud-work-muted">Model review of supplied text.</p>{task.steps.flatMap(s=>(s.checks||[]).map(c=><p key={`${s.id}-${c.attempt}`}>{s.name} · {c.passed?'Passed':'Needs revision'} · {c.feedback}</p>))}</details>}
      {!['completed','failed','cancelled'].includes(task.state)&&<button disabled={task.state==='cancellation_requested'} onClick={()=>void action('cancel',{id:task.id})}>Cancel</button>}
      {['failed','awaiting_input'].includes(task.state)&&<button onClick={()=>{setGoal(task.request);setNotice('Review the goal and add any missing source material before starting a new task.');}}>Review goal</button>}
    </article>)}</div>}
  </div>;
}
