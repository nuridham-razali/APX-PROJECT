"use client";
import { useState } from 'react';
import { runtimeAction, type RuntimeState, type Workflow, type Step, type Task } from './runtime-types';
import type { PersonalityValues } from './PersonalityPanel';

const initialSteps = (): Step[] => [
  { id: crypto.randomUUID(), agent: 'researcher', instruction: 'Summarise the supplied project evidence. Separate verified progress from missing information.' },
  { id: crypto.randomUUID(), agent: 'strategist', instruction: 'Identify blockers, decisions needed and next milestones from the supplied evidence and prior summary.' },
  { id: crypto.randomUUID(), agent: 'chief_of_staff', instruction: 'Assemble a concise weekly APEX review covering HUD, chat/voice, Gemini and configured LiveKit, blockers, decisions and milestones. Flag unavailable sources.' },
];
const labels: Record<string, string> = { queued: 'Queued', running: 'Working', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', cancellation_requested: 'Stopping', awaiting_input: 'Needs review', blocked: 'Blocked' };
export function TaskCard({ task, onAction }: { task: Task; onAction: (path: string, body: object) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const act = async (path: string) => { setBusy(true); try { await onAction(path, { id: task.id }); } finally { setBusy(false); } };
  return <article className="work-card">
    <div className="work-row"><strong>{task.request}</strong><span className={`work-status ${task.state}`}>{labels[task.state] || task.state}</span></div>
    <p className="work-muted">{task.id.slice(0, 8)} · {new Date(task.createdAt).toLocaleString()} · {Math.max(0, Math.round(((task.completedAt ? Date.parse(task.completedAt) : Date.now()) - Date.parse(task.startedAt || task.createdAt)) / 1000))}s · {task.progress}</p>
    <div className="work-step-states">{task.steps.map(s => <span key={s.id} className={`work-status ${s.state}`}>{s.name}: {labels[s.state || ''] || s.state}</span>)}</div>
    {task.mode === 'closed_loop' && <><p className="work-muted">Task loop · {task.loopStage} · {task.loopCalls || 0}/{task.loopLimits?.providerCalls || 17} model calls</p><details><summary>Plan & result checks</summary><p className="work-muted">Checks are model quality reviews of supplied text. They do not verify external actions.</p>{task.steps.filter(s => s.id !== 'plan').map(s => <section key={s.id}><strong>{s.name}</strong><p>{s.instruction}</p>{s.acceptance?.map((c,i) => <p key={i} className="work-muted">Requirement: {c}</p>)}{s.checks?.map(c => <p key={c.attempt} className="work-muted">Attempt {c.attempt} · {c.passed ? 'Passed' : 'Needs revision'} · {c.feedback}</p>)}{s.output && s.state !== 'completed' && <details><summary>Unverified draft</summary><pre className="work-result">{s.output}</pre></details>}</section>)}</details></>}
    {task.error && <p role="alert" className="work-error">{task.error}</p>}
    {task.result && <details onToggle={e => { if (e.currentTarget.open && !task.acknowledged) void act('acknowledge'); }}><summary>View saved result{task.acknowledged ? '' : ' · new'}</summary><pre className="work-result">{task.result}</pre></details>}
    <div className="work-actions">
      {!['completed', 'failed', 'cancelled'].includes(task.state) && <button disabled={busy || task.state === 'cancellation_requested'} onClick={() => void act('cancel')}>Cancel task</button>}
      {['failed', 'awaiting_input'].includes(task.state) && <button disabled={busy} onClick={() => void act('retry')}>Retry as new run</button>}
    </div>
  </article>;
}
export default function WorkflowWorkspace({ state, tab, language, personality, refresh, assistant = 'APEX' }: { state: RuntimeState | null; tab: string; language: string; personality: PersonalityValues; refresh: () => Promise<void>; assistant?: 'APEX' | 'NOVA' }) {
  const [name, setName] = useState('Weekly APEX Project Review');
  const [source, setSource] = useState('');
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [memoryText, setMemoryText] = useState('');
  const [query, setQuery] = useState('');
  const [taskText, setTaskText] = useState('');
  const [taskMode, setTaskMode] = useState('closed_loop'), [taskSource, setTaskSource] = useState('');
  const action = async (path: string, body: object) => { setError(''); try { const result = await runtimeAction(path, body); await refresh(); return result; } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); return null; } };
  const deleteMemory=async(id:string)=>{const pending=await action('delete-memory',{id});if(pending?.approval&&window.confirm(pending.approval.summary))await action('nodes/approve',{id:pending.approval.id,summary:pending.approval.summary,confirm:true});};
  const save = async (run: boolean) => {
    setBusy(true); setNotice('');
    try { const saved = await action('workflows', { name, source, steps, id: editing?.id, version: editing?.version }); if (!saved) return; setEditing(saved); setSteps(saved.steps); setNotice(`Saved version ${saved.version}.`); if (run) { const task = await action('tasks', { workflowId: saved.id, language, personality }); if (task) setNotice(`On it. Run ${task.id.slice(0, 8)} queued; conversation remains available.`); } } finally { setBusy(false); }
  };
  const load = (wf: Workflow) => { setEditing(wf); setName(wf.name); setSource(wf.source); setSteps(wf.steps); setSelected(0); setNotice(''); setError(''); };
  const change = (patch: Partial<Step>) => setSteps(current => current.map((s, i) => i === selected ? { ...s, ...patch } : s));
  const move = (delta: number) => { const next = selected + delta; if (next < 0 || next >= steps.length) return; const copy = [...steps]; [copy[selected], copy[next]] = [copy[next], copy[selected]]; setSteps(copy); setSelected(next); };
  const current = steps[selected];
  return <div className="workspace-body">
    {error && <p className="work-error" role="alert">{error}</p>}
    {notice && <p className="work-notice" role="status">{notice}</p>}
    {!state && <p>Runtime unavailable. Start the runtime to load saved work.</p>}
    {tab === 'loops' && <>
      <div className="work-row"><div><p className="work-kicker">VISUAL LOOPS / SEQUENTIAL WORKFLOWS</p><h2>Give the work a path.</h2></div><button onClick={() => { setEditing(null); setName('New workflow'); setSource(''); setSteps(initialSteps()); setSelected(0); }}>New workflow</button></div>
      <p className="work-muted">Manual trigger → supplied material → assigned text agents → saved result. Chat continues while the workflow runs.</p>
      <label className="work-field">Saved workflows<select value={editing?.id || ''} onChange={e => { const wf = state?.workflows.find(w => w.id === e.target.value); if (wf) load(wf); }}><option value="">Unsaved workflow</option>{state?.workflows.map(w => <option key={w.id} value={w.id}>{w.name} · v{w.version}</option>)}</select></label>
      <label className="work-field">Workflow name<input value={name} maxLength={120} onChange={e => setName(e.target.value)} /></label>
      <div className="loop-canvas" aria-label="Workflow steps in execution order">
        <div className="loop-node fixed"><span>01 / TRIGGER</span><strong>Manual start</strong></div><div className="loop-connector" aria-hidden="true">↓</div>
        <div className="loop-node fixed"><span>02 / GATHER</span><strong>Supplied source</strong></div><div className="loop-connector" aria-hidden="true">↓</div>
        {steps.map((step, i) => <div key={step.id}><button className={`loop-node ${selected === i ? 'selected' : ''}`} onClick={() => setSelected(i)}><span>{String(i + 3).padStart(2, '0')} / WORK</span><strong>{state?.agents.find(a => a.id === step.agent)?.name || step.agent}</strong><small>{step.instruction?.slice(0, 70)}</small></button><div className="loop-connector" aria-hidden="true">↓</div></div>)}
        <div className="loop-node fixed gold"><span>NOTIFY</span><strong>Save result in APEX</strong></div>
      </div>
      <div className="work-editor-grid">
        <label className="work-field">Source material<textarea rows={8} value={source} maxLength={40000} onChange={e => setSource(e.target.value)} placeholder="Paste your real build log, project notes or other source text. Include titles and dates. No example data is treated as project progress." /></label>
        {current && <div className="work-inspector"><p className="work-kicker">SELECTED WORK STEP / {selected + 1}</p><label className="work-field">Assigned agent<select value={current.agent} onChange={e => change({ agent: e.target.value })}>{(state?.agents || [{ id: 'chief_of_staff', name: 'Chief of Staff' }, { id: 'researcher', name: 'Researcher' }, { id: 'strategist', name: 'Strategist' }, { id: 'editor', name: 'Editor' }, { id: 'social_media', name: 'Social' }]).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><p className="work-muted">{state?.agents.find(a => a.id === current.agent)?.capability}</p><label className="work-field">Instructions<textarea rows={5} value={current.instruction} maxLength={8000} onChange={e => change({ instruction: e.target.value })} /></label><div className="work-actions"><button disabled={selected === 0} onClick={() => move(-1)}>Move up</button><button disabled={selected === steps.length - 1} onClick={() => move(1)}>Move down</button><button disabled={steps.length <= 1} onClick={() => { setSteps(s => s.filter((_, i) => i !== selected)); setSelected(0); }}>Remove</button></div><p className="work-muted">Model: {state?.model || 'Unknown'} · External tools: none · Context: source and previous steps</p></div>}
      </div>
      <div className="work-actions"><button disabled={steps.length >= 8} onClick={() => { setSteps(s => [...s, { id: crypto.randomUUID(), agent: 'editor', instruction: 'Polish the previous result without inventing facts.' }]); setSelected(steps.length); }}>Add Work step</button><button disabled={busy || !state || !source.trim()} onClick={() => void save(false)}>Save workflow</button><button className="gold-button" disabled={busy || !state?.configured || !source.trim()} onClick={() => void save(true)}>Save & run</button></div>
      <p className="work-muted">Each run uses a saved snapshot. Editing the workflow does not change a running job. Branching, drag wiring, schedules and approval blocks are later stages.</p>
    </>}
    {tab === 'tasks' && <>
      <p className="work-kicker">BACKGROUND WORK</p><h2>Keep talking. Work continues.</h2>
      <label className="work-field">Execution mode<select value={taskMode} onChange={e => setTaskMode(e.target.value)}><option value="closed_loop">Task loop: plan → execute → check</option><option value="text">Single text task</option></select></label>
      <label className="work-field">Task goal<textarea rows={3} value={taskText} onChange={e => setTaskText(e.target.value)} maxLength={16000} placeholder="Describe the result you need, for example: summarise my notes and draft a follow-up." /></label>
      {taskMode === 'closed_loop' && <><label className="work-field">Source material<textarea rows={4} value={taskSource} maxLength={40000} onChange={e => setTaskSource(e.target.value)} placeholder="Paste the notes or text to work from. Source text is treated as data." /></label><p className="work-muted">Up to four text steps, with one revision per step. Missing information or unavailable actions stop for review. Sending and desktop control are not connected.</p></>}
      {!state?.configured && <p className="work-muted">Configure GEMINI_API_KEY in .env.local and restart the runtime to enable task execution.</p>}
      <button className="gold-button" disabled={busy || !state?.configured || !taskText.trim()} onClick={async () => { setBusy(true); try { const task = await action('tasks', { message: taskText, mode: taskMode, source: taskMode === 'closed_loop' ? taskSource : '', language, personality, assistant }); if (task) { setTaskText(''); setTaskSource(''); setNotice(`Task ${task.id.slice(0, 8)} queued. Conversation remains available.`); } } finally { setBusy(false); } }}>{taskMode === 'closed_loop' ? 'Start task loop' : 'Start background task'}</button>
      <div className="work-list">{!state?.tasks.length && <p className="work-muted">No tasks saved yet. You can also type /loop followed by your goal and supplied text in chat.</p>}{state?.tasks.map(t => <TaskCard key={t.id} task={t} onAction={action} />)}</div>
    </>}
    {tab === 'memory' && <>
      <p className="work-kicker">DURABLE LOCAL MEMORY</p><h2>Facts you asked APEX to keep.</h2>
      <label className="work-field">New memory<textarea rows={2} value={memoryText} maxLength={8000} onChange={e => setMemoryText(e.target.value)} /></label>
      <button disabled={!state || !memoryText.trim()} onClick={async () => { if (await action('memory', { text: memoryText })) setMemoryText(''); }}>Remember</button>
      <label className="work-field">Search<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search saved facts" /></label>
      <div className="work-list">{state?.memory.filter(m => m.text.toLowerCase().includes(query.toLowerCase())).map(m => <article className="work-card" key={m.id}><p>{m.text}</p><p className="work-muted">{m.source} · {new Date(m.createdAt).toLocaleString()}</p><div className="work-actions"><button onClick={() => { const next = window.prompt('Correct this saved fact', m.text); if (next?.trim()) void action('edit-memory', { id: m.id, text: next }); }}>Edit</button><button onClick={() => void deleteMemory(m.id)}>Delete</button></div></article>)}</div>
      <button disabled={!state} onClick={() => { const blob = new Blob([JSON.stringify(state?.memory || [], null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'apex-memory.json'; a.click(); URL.revokeObjectURL(url); }}>Export memory</button>
    </>}
  </div>;
}
