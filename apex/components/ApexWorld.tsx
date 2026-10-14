"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import ApexHeroOrb, { type OrbState } from './ApexHeroOrb';
import ReasoningWebJs from './ReasoningWeb';
import GalaxyBackground from './GalaxyBackground';
import LocationHud from './LocationHud';
import OrbStatusBar from './OrbStatusBar';
import ChatPanel from './ChatPanel';
import PersonalityPanel, { PRESETS, type PersonalityPreset, type PersonalityValues } from './PersonalityPanel';
import WorkflowWorkspace from './WorkflowWorkspace';
import type { VoiceAPI } from './VoiceChat';
import { runtimeAction, type Diagnostic, type RuntimeState } from './runtime-types';
export type NodeSel = { name: string; key: string; color: string };
const ReasoningWeb = ReasoningWebJs as unknown as React.ComponentType<{ state?: string; trace?: unknown; mode?: string; coreless?: boolean; reduced?: boolean; onSelect?: (n: NodeSel) => void }>;
export const ROSTER = ['chief_of_staff', 'memory', 'strategist', 'researcher', 'finance', 'editor', 'sales', 'marketing', 'ops', 'social_media', 'engineering', 'design', 'developer', 'analytics', 'crm', 'calendar', 'email', 'drive'].map(key => ({ key, name: ({ chief_of_staff: 'Chief of Staff', social_media: 'Social' } as Record<string, string>)[key] || key.charAt(0).toUpperCase() + key.slice(1), color: '#22D3EE' }));
export default function ApexWorld() {
  const [voiceStatus, setVoiceStatus] = useState('Mic off');
  const [focusMode, setFocusMode] = useState(false);
  const voice = useRef<VoiceAPI | null>(null);
  const bootTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bootPulse, setBootPulse] = useState(false);
  useEffect(() => () => { if (bootTimer.current) clearTimeout(bootTimer.current); }, []);
  const checkingRef = useRef(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [report, setReport] = useState<Diagnostic | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [selected, setSelected] = useState<NodeSel | null>(null);
  const [state, setState] = useState<RuntimeState | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('Connecting to local runtime…');
  const [workspace, setWorkspace] = useState('');
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [personality, setPersonality] = useState<PersonalityValues>(PRESETS.Default);
  const [preset, setPreset] = useState<PersonalityPreset>('Default');
  const [language, setLanguage] = useState('English');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [systemReduced, setSystemReduced] = useState(false);
  const [motion, setMotion] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try { const response = await fetch('/api/runtime/state', { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Runtime disconnected.'); setState(data); setConnected(true); setConnectionError(''); }
    catch (e) { setConnected(false); setConnectionError(e instanceof Error ? e.message : 'Runtime disconnected.'); }
  }, []);
  useEffect(() => {
    void refresh();
    const events = new EventSource('/api/runtime/events');
    events.onmessage = event => { try { setState(JSON.parse(event.data)); setConnected(true); setConnectionError(''); } catch {} };
    events.onerror = () => { setConnected(false); setConnectionError('Runtime event connection lost. Reconnecting…'); };
    return () => events.close();
  }, [refresh]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setSystemReduced(media.matches); apply(); media.addEventListener('change', apply);
    try { const saved = JSON.parse(localStorage.getItem('apex.settings') || 'null'); if (saved) { const next = { ...PRESETS.Default }; for (const k of Object.keys(next) as (keyof PersonalityValues)[]) { if (Number.isFinite(saved.personality?.[k])) next[k] = Math.max(0, Math.min(100, Math.round(saved.personality[k]))); } setPersonality(next); if (saved.preset in PRESETS) setPreset(saved.preset); if (['English', 'Malay', '中文'].includes(saved.language)) setLanguage(saved.language); setMotion(saved.motion !== false); } } catch {}
    try { setFocusMode(localStorage.getItem('apex.focusMode') === 'true'); } catch {}
    setSettingsLoaded(true); return () => media.removeEventListener('change', apply);
  }, []);
  useEffect(() => { if (settingsLoaded) try { localStorage.setItem('apex.settings', JSON.stringify({ personality, preset, language, motion })); } catch {} }, [personality, preset, language, motion, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) try { localStorage.setItem('apex.focusMode', String(focusMode)); } catch {} }, [focusMode, settingsLoaded]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.ctrlKey && e.shiftKey && e.code === 'KeyF') { e.preventDefault(); setFocusMode(v => !v); } if (e.key === 'Escape') { setFocusMode(false); setWorkspace(''); setSelected(null); setPersonalityOpen(false); } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  const runCheck = async (announce = false) => {
    if (checkingRef.current) throw new Error('A system check is already running.');
    checkingRef.current = true; setChecking(true); setBootPulse(true); if (bootTimer.current) clearTimeout(bootTimer.current); bootTimer.current = setTimeout(() => setBootPulse(false), 2200); setCheckOpen(true); setCheckError('');
    if (announce) voice.current?.beginTurn();
    try {
      const result: Diagnostic = await runtimeAction('checks', {}); setReport(result);
      const summary = result.summary || 'System check completed.';
      if (announce) await voice.current?.speak(summary);
      return summary;
    } catch (e) { const message = e instanceof Error ? e.message : 'System check failed.'; setCheckError(message); throw e; }
    finally { checkingRef.current = false; setChecking(false); if (announce) voice.current?.endTurn(); }
  };
  const visibleReport = checking ? state?.checks : report || state?.checks;
  const reduced = systemReduced || !motion;
  const activeTasks = connected ? state?.tasks.filter(t => ['running', 'cancellation_requested'].includes(t.state)) || [] : [];
  const activeAgents = [...new Set(activeTasks.flatMap(t => t.steps.filter(s => s.state === 'running' && s.agent).map(s => s.agent!)))];
  const trace = activeAgents.length ? { n: activeTasks.map(t => t.id).join(':'), trace: activeAgents.map(helper => ({ helper })) } : null;
  const working = connected ? state?.tasks.filter(t => ['queued', 'running', 'cancellation_requested'].includes(t.state)).length || 0 : null;
  const unread = state?.tasks.filter(t => t.state === 'completed' && !t.acknowledged).length || 0;
  const agent = state?.agents.find(a => a.id === selected?.key);
  return <div className={`apex-world ${focusMode ? 'focus-mode' : ''} ${bootPulse ? 'system-scanning' : ''} ${reduced ? 'motion-off' : ''}`}>
    <GalaxyBackground reduced={reduced} focus={focusMode} />
    <button className="focus-toggle" aria-pressed={focusMode} title="Ctrl+Shift+F · Escape restores the dashboard" onClick={() => setFocusMode(v => !v)}>{focusMode ? 'Show dashboard' : 'Focus mode'}</button>
    <header className="apex-header"><div><p className="work-kicker">IDHAM RAZALI / PERSONAL AI</p><h1>APEX<span className="apex-version">04.6 / MULTITASKING</span></h1></div><div className="runtime-pill"><span className={`runtime-dot ${connected ? 'connected' : ''}`} />{connected ? 'Runtime connected' : 'Runtime disconnected'}<small>{connected ? (state?.configured ? `${state.model} · key configured` : 'Gemini key missing') : 'Check Start.bat'}</small></div></header>
    <nav className="workspace-nav" aria-label="APEX workspaces"><button aria-pressed={!workspace} onClick={() => { setWorkspace(''); setPersonalityOpen(false); }}>Dashboard</button><button aria-pressed={workspace === 'loops'} onClick={() => { setWorkspace('loops'); setPersonalityOpen(false); }}>Loops</button><button aria-pressed={workspace === 'tasks'} onClick={() => { setWorkspace('tasks'); setPersonalityOpen(false); }}>Tasks {working !== null ? `(${working})` : ''}{unread > 0 ? ` · ${unread} new` : ''}</button><button aria-pressed={workspace === 'memory'} onClick={() => { setWorkspace('memory'); setPersonalityOpen(false); }}>Memory</button><button aria-pressed={personalityOpen} onClick={() => { setPersonalityOpen(v => !v); setWorkspace(''); }}>Personality</button><button aria-pressed={checkOpen} onClick={() => setCheckOpen(v => !v)}>System check</button><label className="nav-language"><span className="visually-hidden">Response language</span><select value={language} onChange={e => setLanguage(e.target.value)}><option>English</option><option>Malay</option><option>中文</option></select></label><label className="nav-motion"><input type="checkbox" checked={motion} onChange={e => setMotion(e.target.checked)} />Motion{systemReduced ? ' · OS reduced' : ''}</label></nav>
    <LocationHud connected={connected} activity={orbState} voiceStatus={voiceStatus} />
    {!connected && <div className="runtime-warning" role="status">{connectionError}</div>}
    <div className="world-graph" aria-hidden="true"><ReasoningWeb state="standby" trace={reduced ? null : trace} mode="full" coreless reduced={reduced} onSelect={setSelected} /></div>
    <div className="world-orb"><div className="boot-rings" aria-hidden="true"><i /><i /><i /></div><ApexHeroOrb state={orbState} interactive={false} reduced={reduced} /></div>
    <div className="world-activity"><span>CONVERSATION / {orbState.toUpperCase()}</span><span>BACKGROUND / {connected ? (activeTasks.length ? `${activeTasks.length} running` : working ? 'queued' : 'idle') : 'unknown'}</span></div>
    <nav className="agent-picker" aria-label="Inspect agent capabilities"><select aria-label="Agent overview" value={selected?.key || ''} onChange={e => { const a = ROSTER.find(r => r.key === e.target.value); if (a) setSelected(a); }}><option value="">Inspect an agent…</option>{ROSTER.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}</select></nav>
    <ChatPanel onVoiceStatus={setVoiceStatus} onVoiceReady={api => { voice.current = api; }} onSystemCheck={() => runCheck()} onActivity={setOrbState} personality={personality} language={language} onWorkspace={setWorkspace} />
    {!checkOpen && <button className="initialize-apex" disabled={checking || orbState === 'thinking' || orbState === 'speaking'} onClick={() => { void runCheck(true).catch(() => {}); }}>INITIALIZE APEX <small>Run 12 system checks</small></button>}
    {checkOpen && <aside className="system-check-panel" aria-label="System diagnostics"><div className="work-row"><h2>SYSTEM CHECK</h2><button onClick={() => setCheckOpen(false)} aria-label="Close system checks">Close</button></div><p className="diagnostic-count" role="status">{checking ? `${visibleReport?.checks.length || 0} / 12 · CHECKING` : visibleReport ? `${visibleReport.passed ?? 0} / 12 PASSED` : 'AWAITING INITIALIZATION'}</p><ol>{visibleReport?.checks.map(c => <li key={c.id} className={`check-${c.state}`}><span>{c.state === 'passed' ? '✓' : c.state === 'failed' ? '!' : '–'}</span><div><strong>{c.label}</strong><small>{c.detail}</small></div><em>{c.state}</em></li>)}</ol>{checkError && <p role="alert" className="voice-error">{checkError}</p>}<button disabled={checking || !connected || orbState === 'thinking' || orbState === 'speaking'} onClick={() => { void runCheck(true).catch(() => {}); }}>{checking ? 'Checking…' : 'Run system check'}</button><p className="work-muted">Provider access and browser voice are separate. Microphone stays off until enabled.</p></aside>}
    <div className="world-status"><OrbStatusBar state={orbState} minimal={focusMode} /></div>
    {personalityOpen && <div className="personality-wrap"><PersonalityPanel values={personality} preset={preset} onChange={(key, value) => { setPersonality(p => ({ ...p, [key]: value })); setPreset('Default'); }} onPreset={next => { setPreset(next); setPersonality({ ...PRESETS[next] }); }} /></div>}
    {workspace && <section className="workspace-shell" aria-label={`${workspace} workspace`}><div className="workspace-shell-header"><span>{workspace.toUpperCase()} / {connected ? 'LOCAL RUNTIME' : 'STATUS UNKNOWN'}</span><button onClick={() => setWorkspace('')} aria-label="Close workspace">Close</button></div><WorkflowWorkspace state={state} tab={workspace} language={language} personality={personality} refresh={refresh} /></section>}
    {selected && <aside className="agent-inspector" aria-label={`${selected.name} overview`}><div className="work-row"><h2>{selected.name}</h2><button onClick={() => setSelected(null)} aria-label="Close agent overview">Close</button></div><p>{selected.key === 'memory' ? 'Explicit local memory storage and retrieval.' : agent?.capability || 'Planned capability. No tool handler is connected for this role.'}</p><p className="work-muted">Status: {!connected ? 'Unknown — runtime disconnected' : selected.key === 'memory' ? 'Local storage available' : activeAgents.includes(selected.key) ? 'Working' : agent ? state?.configured ? 'Text handler configured — provider not yet verified' : 'Gemini key missing' : 'Not configured'}</p><p className="work-muted">Email, calendar, CRM, image generation and social publishing are not connected.</p></aside>}
  </div>;
}
