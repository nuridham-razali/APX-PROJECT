import { randomUUID } from 'node:crypto';
import { AGENTS, validateWorkflow } from './engine.mjs';
import { DEFAULT_MODEL, brainConfig } from './provider.mjs';
import {connectedRead,integrationConfigured} from './node-tools.mjs';
import {NODE_REGISTRY} from '../lib/node-registry.mjs';
export async function runDiagnostics(engine, { fetcher = fetch, onUpdate = () => {} } = {}) {
  if (engine.checking) throw Object.assign(new Error('A system check is already running.'), { status: 409 });
  engine.checking = true;
  const report = { id: randomUUID(), state: 'running', createdAt: new Date().toISOString(), checks: [] };
  engine.latestCheck = report;
  const publish=()=>{engine.store.put('diagnostic',report);onUpdate(report);};
  const check = async (id, label, fn) => {
    const row={id,label,state:'running',detail:'Checking…'};report.checks.push(row);publish();
    let deadline;try { row.detail = await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Diagnostic timed out after 10 seconds.')),10000);})]); row.state='passed'; }
    catch (e) { row.state=e?.skipped?'skipped':'failed';row.detail=e instanceof Error?e.message:'Check failed.'; }
    clearTimeout(deadline);publish();
  };
  const records = kind => { const list = engine.store.list(kind); return `${list.length} saved record${list.length === 1 ? '' : 's'} readable.`; };
  const env = engine.env;
  const brain = brainConfig(env),model=brain.model;
  try {
    publish();
    await check('runtime', 'Local runtime', () => 'Authenticated runtime responded.');
    await check('node', 'Node runtime version', () => { const [major, minor] = process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && minor < 13)) throw new Error('Node 22.13+ required.'); return `Node ${process.versions.node}`; });
    await check('database', 'Database write and read', () => {
      const id = randomUUID();
      try { engine.store.put('probe', { id, value: id }); if (engine.store.get('probe', id)?.value !== id) throw new Error('Database round trip failed.'); return 'SQLite round trip verified.'; }
      finally { engine.store.remove('probe', id); }
    });
    await check('memory', 'Persistent memory', () => records('memory'));
    await check('conversation', 'Conversation storage', () => records('conversation'));
    await check('tasks', 'Saved task state', () => { const tasks = engine.store.list('task'); const allowed = ['queued','running','awaiting_input','awaiting_approval','completed','failed','cancellation_requested','cancelled']; if (tasks.some(t => !allowed.includes(t.state))) throw new Error('An unknown task state needs review.'); return `${tasks.length} task states validated.`; });
    await check('workflows', 'Workflow definitions', () => { const workflows = engine.store.list('workflow'); workflows.forEach(validateWorkflow); return `${workflows.length} definitions validated.`; });
    await check('agents', 'Node handler registry', () => { if (NODE_REGISTRY.length!==18||new Set(NODE_REGISTRY.map(a=>a.id)).size!==18||typeof engine.execute!=='function')throw new Error('Node registry unavailable.');return '18 nodes registered. Provider permissions and role outputs require separate verification.'; });
    await check('worker', 'Background scheduler', () => { if (!engine.lastWorkerHeartbeat || Date.now() - engine.lastWorkerHeartbeat > 5000) throw new Error('Scheduler heartbeat missing or stale.'); return 'Recent scheduler heartbeat received.'; });
    await check('key', brain.provider==='ollama'?'Local brain configuration':'Gemini configuration', () => { if (!brain.configured) throw new Error('GEMINI_API_KEY is missing.'); return brain.provider==='ollama'?'Ollama local inference; no API key or paid fallback.':'Server key present; value is never displayed.'; });
    await check('model', 'Configured model ID', () => { if (!(brain.provider==='ollama'?/^[a-zA-Z0-9._:/-]+$/:/^[a-zA-Z0-9._-]+$/).test(model)) throw new Error('Invalid model ID format.'); return model; });
    await check('provider', brain.provider==='ollama'?'Ollama model access':'Gemini model access', async () => {
      if(brain.provider==='ollama'){
        const response=await fetcher(`${brain.base}/api/tags`,{signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw new Error('Ollama is not responding.');
        const data=await response.json();
        if(!data.models?.some(m=>m.name===model||m.model===model))throw new Error('Selected local model is not installed in Ollama.');
        return 'Local model installed. A real generation still needs its own verification.';
      }
      if (!env.GEMINI_API_KEY) { const e = new Error('Skipped: add the Gemini key first.'); e.skipped = true; throw e; }
      if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Cannot check an invalid model ID.');
      let response;
      try { response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(8000) }); }
      catch { throw new Error('Provider request could not complete. Check internet connectivity and try again.'); }
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}. Check model availability, key or access.`);
      let metadata; try { metadata = await response.json(); } catch { throw new Error('Provider returned unreadable model metadata.'); }
      if (!metadata?.supportedGenerationMethods?.includes('generateContent')) throw new Error('This model does not advertise generateContent support.');
      return 'Model metadata accessible. A real generation still needs its own verification.';
    });
    const untested=message=>{const error=new Error(message);error.skipped=true;throw error;};
    await check('generation','Model generation evidence',()=>untested('Untested by this check: no generation request is made, to avoid quota use.'));
    await check('fish','Fish Audio output transport',()=>untested('Untested by this check: no speech synthesis or speaker test is requested.'));
    await check('microphone','Microphone / STT transport',()=>untested('Untested: requires an explicit microphone session and real spoken input.'));
    for(const id of ['email','calendar','drive'])await check(`integration-${id}`,`${id[0].toUpperCase()+id.slice(1)} read integration`,async()=>{if(!integrationConfigured(id,env))return untested('Not configured: backend OAuth access is missing.');const result=await connectedRead(id,env,new AbortController().signal,fetcher);return `${result.service} read endpoint responded. Write actions are not tested.`;});
    report.state = 'completed'; report.completedAt = new Date().toISOString();
    report.passed = report.checks.filter(c => c.state === 'passed').length;
    report.summary = `${report.passed} of ${report.checks.length} checks passed. ${report.checks.filter(c=>c.state==='failed').length} failed; ${report.checks.filter(c=>c.state==='skipped').length} unverified or not configured. Review the checklist.`;
    publish();
    return report;
  } finally { engine.checking = false; }
}
