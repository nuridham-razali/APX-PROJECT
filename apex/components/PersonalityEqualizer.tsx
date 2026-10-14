"use client";
import {useEffect,useState,type CSSProperties} from 'react';
import {X} from 'lucide-react';
import {PERSONALITY_CONTROLS,PERSONALITY_PRESETS,PERSONALITY_SAMPLE,validatePersonality} from '../lib/personality.mjs';
import {runtimeAction} from './runtime-types';
import './personality-equalizer.css';
type Profile={version:number;levels:Record<string,number>;preset:string;revision:number};
export default function PersonalityEqualizer({onClose}:{onClose:()=>void}){
 const [profile,setProfile]=useState<Profile|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[sample,setSample]=useState(''),[provider,setProvider]=useState(''),[consent,setConsent]=useState(false);
 useEffect(()=>{let live=true;const accept=(p:unknown)=>{try{const c=validatePersonality(p);if(live)setProfile(previous=>!previous||c.revision>=previous.revision?c:previous);}catch{}};
 void fetch('/api/runtime/state',{cache:'no-store'}).then(async r=>{const s=await r.json();if(!r.ok)throw new Error(s.error);accept(s.personality);if(live)setProvider(s.provider);}).catch(e=>{if(live)setError(e.message);});
 const events=new EventSource('/api/runtime/events');events.onmessage=e=>{try{const s=JSON.parse(e.data);accept(s.personality);if(live)setProvider(s.provider);}catch{}};
 const changed=(e:Event)=>accept((e as CustomEvent).detail);window.addEventListener('apex-personality-updated',changed);
 return()=>{live=false;events.close();window.removeEventListener('apex-personality-updated',changed);};},[]);
 const update=async(action:object)=>{if(!profile||pending)return;setPending(true);setError('');try{const p=validatePersonality(await runtimeAction('personality',{action,revision:profile.revision}));setProfile(p);window.dispatchEvent(new CustomEvent('apex-personality-updated',{detail:p}));}catch(e){setError(e instanceof Error?e.message:'Update failed.');}finally{setPending(false);}};
 const test=async()=>{setConsent(false);setPending(true);setError('');try{const r=await runtimeAction('chat',{message:PERSONALITY_SAMPLE,assistant:'APEX',conversationId:crypto.randomUUID()});setSample(r.message);}catch(e){setError(e instanceof Error?e.message:'Test failed.');}finally{setPending(false);}};
 return <section className="personality-equalizer" role="dialog" aria-label="Personality equalizer"><header><strong>PERSONALITY</strong><button aria-label="Close personality" onClick={onClose}><X size={14}/></button></header>
 <div className="personality-columns">{PERSONALITY_CONTROLS.map(c=><div className="personality-column" key={c.key} style={{'--trait-color':c.color} as CSSProperties}>
 <label id={`trait-${c.key}`}>{c.label}</label><div className="personality-segments" role="slider" tabIndex={profile?0:-1} aria-labelledby={`trait-${c.key}`} aria-valuemin={1} aria-valuemax={5} aria-valuenow={profile?.levels[c.key]??1} aria-disabled={!profile||pending} onKeyDown={e=>{const delta=['ArrowUp','ArrowRight','PageUp'].includes(e.key)?1:['ArrowDown','ArrowLeft','PageDown'].includes(e.key)?-1:0;if(delta||['Home','End'].includes(e.key)){e.preventDefault();void update(delta?{setting:c.key,delta}:{setting:c.key,level:e.key==='Home'?1:5});}}}>
 {[5,4,3,2,1].map(level=><button key={level} disabled={!profile||pending} className={profile&&level<=profile.levels[c.key]?'lit':''} aria-label={`Set ${c.label} to ${level}`} aria-pressed={profile?.levels[c.key]===level} onClick={()=>void update({setting:c.key,level})}/>)}</div><output>{profile?.levels[c.key]??'—'}</output></div>)}</div>
 <div className="personality-presets">{Object.keys(PERSONALITY_PRESETS).map(name=><button key={name} disabled={!profile||pending} aria-pressed={profile?.preset===name} onClick={()=>void update({preset:name})}>{name.toUpperCase()}</button>)}</div>
 <p className="personality-save" role="status">{pending?'UPDATING…':profile?`${profile.preset.toUpperCase()} · SAVED`:'CONNECTING…'}</p><p className="personality-note">Style changes. Accuracy and permissions stay constant.</p>
 <button className="personality-test" disabled={!profile||pending} onClick={()=>setConsent(true)}>Test personality</button>{consent&&<div className="personality-consent"><p>Generate the fixed sample question using {provider||'your selected provider'}? {provider==='gemini'?'This calls Gemini and may consume paid API quota.':'This runs local model inference.'} No voice request is made.</p><button disabled={pending} onClick={()=>void test()}>Generate sample</button> <button onClick={()=>setConsent(false)}>Cancel test</button></div>}{sample&&<details open><summary>Sample response</summary><p>{PERSONALITY_SAMPLE}</p><p>{sample}</p></details>}{error&&<p role="alert">{error}</p>}
 </section>;
}
