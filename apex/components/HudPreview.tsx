"use client";

import { useEffect, useRef, useState } from 'react';
import { AudioLines, ArrowUp, ChevronRight, Circle, Cpu, FolderOpen, MessageSquare, Moon, Network, Pause, Play, Settings2, ShieldCheck, Sparkles, Repeat2, UserRound, X } from 'lucide-react';
import LoopsPanel from './LoopsPanel';
import PersonalityEqualizer from './PersonalityEqualizer';
import ApexHumanoid from './ApexHumanoid';
import ApexSystemCheck from './ApexSystemCheck';
import ApexReasoningNetwork from './ApexReasoningNetwork';
import HudParticleCore from './HudParticleCore';
import ShaderBackground from './ShaderBackground';
import type {NovaSignal,NovaPhase} from './nova/visual-config';
import HudWaveform from './HudWaveform';
import NovaHud from './nova/NovaHud';
import ApexSessionControl from './ApexSessionControl';
import HudWorkPanel from './HudWorkPanel';
import HudResponseOverlay from './HudResponseOverlay';
import WakeVoiceIndicator from './WakeVoiceIndicator';
import {Eye,EyeOff} from 'lucide-react';
import OverviewCard from './OverviewCard';
import { coreRadius } from './hud-visuals';
import {hasAssistantWork,assistantActivity} from '../lib/assistant-activity.mjs';
import './hud-preview.css';
import './overview-reference.css';

type Persona = 'APEX' | 'NOVA';
type Activity = 'standby' | 'listening' | 'thinking' | 'speaking';
const defaults = { APEX: { warmth: 85, humor: 35, clarity: 75, initiative: 60 }, NOVA: { warmth: 70, humor: 10, clarity: 95, initiative: 80 } };
const traits = [ ['warmth', 'Warmth', 'Reserved', 'Welcoming'], ['humor', 'Humor', 'Earnest', 'Playful'], ['clarity', 'Directness', 'Detailed', 'Concise'], ['initiative', 'Initiative', 'On request', 'Proactive'] ] as const;

function CoreScene({ persona, activity, motion }: { persona: Persona; activity: Activity; motion: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let frame = 0, w = 0, h = 0, last = 0;
    const nova = persona === 'NOVA';
    const color = nova ? '192,148,255' : '55,217,239';
    const gold = nova ? '226,203,255' : '241,199,106';
    let seed = 67;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    const stars = Array.from({ length: 360 }, () => ({ x: rand(), y: rand(), r: rand() * 1.1 + .2, a: rand() * .5 + .15 }));
    const resize = () => { w = canvas.clientWidth; h = canvas.clientHeight; const d = Math.min(devicePixelRatio, 1.5); canvas.width = w * d; canvas.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    const draw = (time: number) => {
      const t = motion ? time / 1000 : 0;
      ctx.clearRect(0, 0, w, h);
      const x = w / 2, y = h * .5, r = coreRadius(w, h, persona, activity);
      const active = activity !== 'standby';
      const aura = ctx.createRadialGradient(x, y, r * .2, x, y, r * 3.4);
      aura.addColorStop(0, `rgba(${color},${nova ? '.14' : '.07'})`); aura.addColorStop(.6, `rgba(${color},.025)`); aura.addColorStop(1, 'transparent'); ctx.fillStyle = aura; ctx.fillRect(0, 0, w, h);
      stars.forEach(s => { ctx.fillStyle = `rgba(${color},${s.a * (.8 + .2 * Math.sin(t * .3 + s.x * 90))})`; ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2); ctx.fill(); });
      if (nova) {
        const cloud = ctx.createRadialGradient(x, y, r * .65, x, y, r * 2.7);
        cloud.addColorStop(0, 'transparent'); cloud.addColorStop(.44, `rgba(110,45,185,${active ? '.13' : '.035'})`); cloud.addColorStop(1, 'transparent'); ctx.fillStyle = cloud; ctx.fillRect(x-r*3,y-r*3,r*6,r*6);
        for (let j = 0; j < 10; j++) { ctx.save(); ctx.translate(x, y); ctx.rotate(t * .08 + j * Math.PI / 10); ctx.strokeStyle = `rgba(${j % 2 ? color : gold},${active ? '.65' : '.18'})`; ctx.shadowColor = `rgb(${color})`; ctx.shadowBlur = active ? 20 : 7; ctx.lineWidth = j % 3 ? .8 : 1.8; ctx.beginPath(); ctx.ellipse(0, 0, r * (1.45 + .09 * Math.sin(t + j)), r * (.72 + .08 * Math.sin(t*.5+j)), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      }
    };
    const animate = (t: number) => { if (t - last >= 32) { draw(t); last = t; } frame = requestAnimationFrame(animate); };
    const observer = new ResizeObserver(() => { resize(); draw(last); }); observer.observe(canvas); resize(); draw(0); if (motion) frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [persona, activity, motion]);
  return <canvas ref={ref} className="hud-scene" aria-hidden="true" />;
}

export default function HudPreview({hostedHudOnly=false}:{hostedHudOnly?:boolean}) {
  const voiceSignal=useRef<NovaSignal>({phase:'idle',inputLevel:0,outputLevel:0,preview:false});
  const [persona, setPersona] = useState<Persona>('APEX');
  const [voiceActivity, setActivity] = useState<Activity>('standby');
  const [backendWorking,setBackendWorking]=useState(false);
  const [chatRequestActive,setChatRequestActive]=useState(false),[taskRequestActive,setTaskRequestActive]=useState(false);
  const requestActive=chatRequestActive||taskRequestActive;
  const activity=assistantActivity(voiceActivity,backendWorking,requestActive) as Activity;
  useEffect(()=>{
    if(hostedHudOnly)return;
    let live=true;
    const update=(snapshot:unknown)=>{if(live)setBackendWorking(hasAssistantWork(snapshot));};
    void fetch('/api/runtime/state',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(update).catch(()=>{});
    const events=new EventSource('/api/runtime/events');
    events.onmessage=e=>{try{update(JSON.parse(e.data));}catch{}};
    events.onerror=()=>{if(live)setBackendWorking(false);};
    return()=>{live=false;events.close();};
  },[hostedHudOnly]);
  const [panel, setPanel] = useState<'tasks' | 'personality' | 'loops' | 'chat' | null>(null);
  const [workPanel,setWorkPanel]=useState<'tasks'|'chat'|null>(null);
  const [hudVoice,setHudVoice]=useState({active:false,ready:false,busy:false,mode:'deepgram',error:''});
  const [showVoiceControls,setShowVoiceControls]=useState(true);
  useEffect(()=>{try{setShowVoiceControls(localStorage.getItem('apex.voiceControls.visible')!=='false');}catch{}},[]);
  const toggleVoiceControls=()=>setShowVoiceControls(visible=>{const next=!visible;try{localStorage.setItem('apex.voiceControls.visible',String(next));}catch{}return next;});
  useEffect(()=>{const update=(event:Event)=>setHudVoice((event as CustomEvent).detail);window.addEventListener('apex-hud-voice-status',update);return()=>window.removeEventListener('apex-hud-voice-status',update);},[]);
  useEffect(()=>{if(panel==='tasks'||panel==='chat')setWorkPanel(panel);},[panel]);
  const [systemCheckOpen,setSystemCheckOpen]=useState(false);
  const [checkStage,setCheckStage]=useState('existing');
  const [showReasoning, setShowReasoning] = useState(true);
  const [showHumanoid,setShowHumanoid]=useState(false);

  const [motion, setMotion] = useState(true);
  const [time, setTime] = useState<Date | null>(null);
  const [profiles, setProfiles] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTime(new Date()); const tick = setInterval(() => setTime(new Date()), 1000); const mq = matchMedia('(prefers-reduced-motion: reduce)'); setMotion(!mq.matches); const respectMotion = () => setMotion(!mq.matches); mq.addEventListener('change', respectMotion); try { const saved = JSON.parse(localStorage.getItem('apex.hud.v1') || 'null'); if (saved) { if (typeof saved.showReasoning === 'boolean') setShowReasoning(saved.showReasoning); if(typeof saved.showHumanoid === 'boolean')setShowHumanoid(saved.showHumanoid); if (saved.persona === 'APEX' || saved.persona === 'NOVA') setPersona(saved.persona); const clean = structuredClone(defaults); for (const p of ['APEX', 'NOVA'] as const) for (const [key] of traits) if (Number.isFinite(saved.profiles?.[p]?.[key])) clean[p][key] = Math.max(0, Math.min(100, saved.profiles[p][key])); setProfiles(clean); } } catch {} setLoaded(true); return () => { clearInterval(tick); mq.removeEventListener('change', respectMotion); }; }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem('apex.hud.v1', JSON.stringify({ persona, profiles, showReasoning, showHumanoid })); } catch {} }, [persona, profiles, showReasoning, showHumanoid, loaded]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setPanel(null); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  const voicePhase=(phase:NovaPhase)=>setActivity(phase==='idle'?'standby':phase==='processing'?'thinking':phase);
  const startSystemCheck=()=>{window.dispatchEvent(new CustomEvent('apex-browser-voice-command',{detail:{action:'pause'}}));setPanel(null);setSystemCheckOpen(true);};
  const toggle = (next: typeof panel) => setPanel(panel === next ? null : next);
  const openHumanoid=()=>{setSystemCheckOpen(false);setPanel(null);setWorkPanel(null);setShowHumanoid(true);};
  if (persona === 'NOVA') return <NovaHud onApex={() => setPersona('APEX')} />;
  const checkWaves=systemCheckOpen&&['waves','shockwave','settle','completed','waiting'].includes(checkStage);
  const humanoidVisible=showHumanoid&&!systemCheckOpen;
  return <main data-check-stage={systemCheckOpen?checkStage:undefined} className={`hud-preview video-reference ${persona.toLowerCase()} ${panel && panel!=='personality'&&panel!=='loops' ? 'panel-open' : ''} ${humanoidVisible?'humanoid-active':''}`}>
    {humanoidVisible&&<ApexHumanoid activity={activity} signal={voiceSignal} motion={motion}/>}
    <div style={{display:humanoidVisible?'none':undefined}}>
    <ShaderBackground opacity={!systemCheckOpen||checkStage==='existing'||checkWaves?0.66:0} apexPalette motion={motion} voiceActive={activity==='speaking'||checkWaves}/>
    <CoreScene persona={persona} activity={activity} motion={motion} />
    {showReasoning && <ApexReasoningNetwork activity={activity} motion={motion} reconstruct={systemCheckOpen}/>}
    <HudParticleCore persona={persona} activity={activity} motion={motion} />
    <button className="hud-core-trigger" aria-label="Preview core animation: standby, thinking, speaking" onClick={() => setActivity(activity === 'standby' ? 'thinking' : activity === 'thinking' ? 'speaking' : 'standby')} />
    <div className="hud-vignette" />
    <HudWaveform activity={activity} motion={motion} />
    </div>
    <header className="hud-overview" style={{visibility:systemCheckOpen?'hidden':undefined}}><OverviewCard/></header>
    <div className="hud-persona-switch" aria-label="Assistant persona">{(['APEX', 'NOVA'] as const).map(p => <button key={p} aria-pressed={persona === p} onClick={() => setPersona(p)}><span className="persona-dot" />{p}</button>)}<span className="hud-persona-caption">ONE ASSISTANT · TWO PERSONALITIES</span></div>
    <button className="hud-preview-state hud-local-voice" disabled={hostedHudOnly} aria-label={hudVoice.active?'Mute APEX microphone':'Enable APEX microphone'} aria-pressed={hudVoice.active} title={hostedHudOnly?'Local backend not connected':hudVoice.error||'Local assistant · recognition uses Deepgram Flux'} onClick={()=>window.dispatchEvent(new Event('apex-hud-toggle-voice'))}>LOCAL · VOICE {hudVoice.active?'ON':'OFF'}<i aria-hidden="true"/></button>
    <div className="hud-identity"><span className="hud-identity-kicker">{persona === 'APEX' ? 'YOUR PERSONAL ASSISTANT' : 'YOUR CALM COMPANION'}</span><h1>{persona}</h1><span className="hud-identity-detail">{persona === 'APEX' ? 'Friendly. Conversational. Here for you.' : 'Warm. Thoughtful. One step ahead.'}</span></div>
    <section className="hud-core-status" aria-label="Core animation preview"><div className="hud-status-symbol"><Circle size={12} /></div><strong>{activity.toUpperCase()}</strong><p>CORE ANIMATION PREVIEW</p><div className="hud-state-selector">{(['standby', 'listening', 'thinking', 'speaking'] as const).map(s => <button key={s} aria-pressed={activity === s} onClick={() => setActivity(s)}>{s}</button>)}</div></section>
    <footer className="hud-footer"><span className="hud-footer-note"><ShieldCheck size={13} /> Sending always requires your confirmation.</span><div className="hud-dock"><button aria-label="Open Loops Engine" title="Loops Engine" aria-pressed={panel==='loops'} onClick={()=>toggle('loops')}><Repeat2 size={17}/><span>Loops</span></button><button aria-label="Open tasks" aria-pressed={panel === 'tasks'} onClick={() => toggle('tasks')}><FolderOpen size={17} /><span>Tasks</span></button><button aria-label="Open conversation" aria-pressed={panel === 'chat'} onClick={() => toggle('chat')}><MessageSquare size={17} /><span>Conversation</span></button><button aria-label="Open personality equalizer" aria-pressed={panel === 'personality'} onClick={() => toggle('personality')}><Settings2 size={17} /><span>Personality</span></button><button aria-label={showReasoning ? 'Hide reasoning web' : 'Show reasoning web'} title={showReasoning ? 'Hide reasoning web' : 'Show reasoning web'} aria-pressed={showReasoning} onClick={() => setShowReasoning(v => !v)}><Network size={17}/><span>Reasoning web</span></button><button aria-label="Run system check" title="Run system check" onClick={startSystemCheck}><ShieldCheck size={17}/><span>System check</span></button><button aria-label={showHumanoid?'Show core HUD':'Show humanoid face'} title={showHumanoid?'Show core HUD':'Show humanoid face'} aria-pressed={showHumanoid} onClick={()=>setShowHumanoid(v=>!v)}><UserRound size={17}/><span>Humanoid face</span></button><div className="dock-divider" /><button aria-label={motion ? 'Pause animation' : 'Play animation'} onClick={() => setMotion(!motion)}>{motion ? <Pause size={16} /> : <Play size={16} />}</button></div><span className="hud-footer-brand">APEX SYSTEMS <span>/</span> PERSONAL EDITION</span></footer>
    {panel==='loops'&&<LoopsPanel onClose={()=>setPanel(null)}/>}
    {panel==='personality'&&<PersonalityEqualizer onClose={()=>setPanel(null)}/>}
    {panel&&panel!=='personality'&&panel!=='loops'&&<button className="hud-panel-backdrop" aria-label="Close panel" onClick={()=>setPanel(null)}/>}
    {workPanel==='tasks'&&<aside className="hud-panel" style={{display:panel==='tasks'?undefined:'none'}} aria-label="Tasks"><div className="hud-panel-head"><span>APEX / TASKS</span><button aria-label="Close panel" onClick={()=>setPanel(null)}><X size={18}/></button></div><HudWorkPanel mode="tasks" assistant="APEX" onRequestActive={setTaskRequestActive} onOpenHumanoid={openHumanoid}/></aside>}
    <aside className="hud-panel" style={{display:panel==='chat'?undefined:'none'}} aria-label="Conversation"><div className="hud-panel-head"><span>APEX / CHAT</span><button aria-label="Close panel" onClick={()=>setPanel(null)}><X size={18}/></button></div>
      {hostedHudOnly?<p className="hud-work-muted">Local backend not connected. Open APEX on your PC to use chat and voice.</p>:<HudWorkPanel onRequestActive={setChatRequestActive} onSystemCheck={startSystemCheck} onOpenHumanoid={openHumanoid} mode="chat" assistant="APEX" voiceSignal={voiceSignal} onVoicePhase={phase=>setActivity(phase==='idle'?'standby':phase==='processing'?'thinking':phase)}/>}
    </aside>
    <HudResponseOverlay signal={voiceSignal}/>
    {!systemCheckOpen&&<ApexSessionControl/>}
    {!systemCheckOpen&&<WakeVoiceIndicator mode={hudVoice.mode} phase={voiceActivity} active={hudVoice.active} error={hudVoice.error} signal={voiceSignal}/>}
    <ApexSystemCheck open={systemCheckOpen} onClose={()=>setSystemCheckOpen(false)} signal={voiceSignal} onPhase={voicePhase} onStage={setCheckStage}/>
  </main>;
}


