import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../runtime/store.mjs';
import { Engine, validateWorkflow } from '../runtime/engine.mjs';
import { generate } from '../runtime/provider.mjs';
const fixtureEnv = { GEMINI_API_KEY: 'test-fixture-key', GEMINI_MODEL: 'fixture-model' };
function setup(t, generator = async () => ({ text: 'Fixture text result', model: 'fixture-model' })) {
  const dir = mkdtempSync(join(tmpdir(), 'apex-test-')); const path = join(dir, 'test.sqlite'); const store = new Store(path);
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  return { store, path, engine: new Engine(store, { generator, env: { ...fixtureEnv } }) };
}
const wf = () => ({ name: 'Fixture review', source: 'Source A: verified test fixture only.', steps: [{ id: 'step-a', agent: 'researcher', instruction: 'Summarise source A.' }, { id: 'step-b', agent: 'editor', instruction: 'Polish the summary.' }] });

test('natural tasks acknowledge immediately; progress and a second task do not wait for background inference', async t => {
  let release, started, calls=0;
  const began=new Promise(r=>{started=r;});const held=new Promise(r=>{release=r;});
  const {engine,store}=setup(t,async(_,__,options)=>{if(options.format==='json')return{text:JSON.stringify({opener:'Happy to help.'})};calls++;started();await held;return{text:JSON.stringify({status:'needs_input',reason:'Supply the source text.',steps:[]})};});
  const first=await engine.chat({message:'Nova, can you please review the supplied report?',conversationId:'natural-one',assistant:'NOVA'});
  assert.match(first.message,/Happy to help.*Queued/);assert.equal(calls,0);assert.equal(store.get('task',first.taskId).state,'queued');
  const work=engine.tick();await began;
  const status=await engine.chat({message:'How long will it take?',conversationId:'natural-one',assistant:'NOVA'});
  assert.match(status.message,/cannot give a reliable finish time/);assert.match(status.message,/Planning a bounded text task/);
  const second=await engine.chat({message:'Draft a follow-up email to Sam.',conversationId:'natural-one',assistant:'NOVA'});
  assert.notEqual(first.taskId,second.taskId);assert.equal(calls,1);assert.equal(store.get('task',first.taskId).state,'running');
  assert.equal(store.get('task',second.taskId).state,'queued');
  release();await work;assert.equal(store.get('task',first.taskId).state,'awaiting_input');
});
test('a foreground turn completes while a background provider request is still pending', async t => {
  let release, started;
  const began = new Promise(r => { started = r; });
  const held = new Promise(r => { release = r; });
  const { engine, store } = setup(t, async (contents) => {
    if (contents[0].parts[0].text.startsWith('Task:')) { started(); await held; return { text: 'Background fixture' }; }
    return { text: 'Foreground fixture' };
  });
  const task = engine.enqueue({ message: 'Write a fixture summary' }); const running = engine.tick(); await began;
  const reply = await engine.chat({ message: 'Are you available?', conversationId: 'conversation-one' });
  assert.equal(reply.message, 'Foreground fixture'); assert.equal(store.get('task', task.id).state, 'running');
  release(); await running; assert.equal(store.get('task', task.id).state, 'completed');
  assert.equal(store.get('conversation', 'conversation-one').contents.length, 2);
});

test('NOVA reaches the existing provider with its tone and unchanged permission limits', async t => {
  let instruction;
  const { engine } = setup(t, async (_, system) => { instruction = system; return { text: 'NOVA fixture' }; });
  const reply = await engine.chat({ message: 'Help me plan', conversationId: 'nova-fixture', assistant: 'NOVA' });
  assert.equal(reply.message, 'NOVA fixture');
  assert.match(instruction, /You are NOVA/);
  assert.match(instruction, /calm, warm, concise and honest/);
  assert.match(instruction, /Tone never changes factual standards or permissions/);
  assert.match(instruction, /never infer connection from a credential alone/);
  assert.match(instruction, /Image generation, social publishing and deployment are not connected/);
  assert.match(instruction, /require approval before settings changes/);
});

test('stopping foreground chat aborts its provider without saving a false answer', async t => {
  let started;
  const began = new Promise(resolve => { started = resolve; });
  const { engine, store } = setup(t, async (_, __, { signal }) => {
    started();
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    return { text: 'Must not be saved' };
  });
  const pending = engine.chat({ message: 'Pending fixture', conversationId: 'nova-stop', assistant: 'NOVA' });
  const rejected = assert.rejects(pending, /Stopped fixture/);
  await began;
  engine.chatControllers.get('nova-stop').abort(new Error('Stopped fixture'));
  await rejected;
  assert.equal(engine.chatControllers.size, 0);
  assert.equal(engine.chatLocks.size, 0);
  assert.ok(!store.get('conversation', 'nova-stop')?.contents.some(c => c.role === 'model'));
});
test('workflow runs ordered steps and active run retains original snapshot after edit', async t => {
  const prompts = []; const { engine, store } = setup(t, async contents => { prompts.push(contents[0].parts[0].text); return { text: `Fixture output ${prompts.length}` }; });
  const saved = engine.saveWorkflow(wf()); const task = engine.enqueue({ workflowId: saved.id });
  engine.saveWorkflow({ ...saved, source: 'Changed source' }); await engine.tick();
  const result = store.get('task', task.id);
  assert.equal(result.state, 'completed'); assert.equal(result.snapshot.source, wf().source); assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Fixture output 1/); assert.doesNotMatch(prompts[0], /Changed source/); assert.equal(result.steps.at(-1).state, 'completed');
});
test('failed work blocks downstream steps and saves partial state', async t => {
  let calls = 0; const { engine, store } = setup(t, async () => { calls++; throw new Error('Fixture provider failure'); });
  const saved = engine.saveWorkflow(wf()); const task = engine.enqueue({ workflowId: saved.id }); await engine.tick();
  const failed = store.get('task', task.id); assert.equal(failed.state, 'failed'); assert.equal(calls, 1); assert.equal(failed.steps[2].state, 'failed'); assert.equal(failed.steps[3].state, 'blocked');
});
test('queued cancellation never starts a provider call', async t => {
  let calls = 0; const { engine, store } = setup(t, async () => { calls++; return { text: 'Fixture' }; });
  const task = engine.enqueue({ message: 'Fixture task' }); engine.cancel(task.id); await engine.tick(); assert.equal(calls, 0); assert.equal(store.get('task', task.id).state, 'cancelled');
});
test('running cancellation is a request until the worker confirms it', async t => {
  let started; const began = new Promise(r => { started = r; });
  const { engine, store } = setup(t, async (_, __, { signal }) => { started(); await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); return { text: 'Should not finish' }; });
  const task = engine.enqueue({ message: 'Fixture pending task' }); const run = engine.tick(); await began;
  assert.equal(engine.cancel(task.id).state, 'cancellation_requested'); await run;
  assert.equal(store.get('task', task.id).state, 'cancelled'); assert.equal(store.get('task', task.id).result, '');
});
test('restart preserves memory and queued tasks, and does not silently rerun interrupted work', t => {
  const { store, engine, path } = setup(t); const queued = engine.enqueue({ message: 'Queued fixture' }); const running = engine.enqueue({ message: 'Interrupted fixture' }); engine.update(running, { state: 'running' });
  store.create('memory', { text: 'Fixture preference', source: 'test' });
  const secondStore = new Store(path);
  try {
    const recovered = new Engine(secondStore, { env: { ...fixtureEnv } });
    assert.equal(recovered.store.list('memory')[0].text, 'Fixture preference'); assert.equal(secondStore.get('task', queued.id).state, 'queued'); assert.equal(secondStore.get('task', running.id).state, 'awaiting_input');
  } finally { secondStore.close(); }
});
test('retry creates a distinct run preserving the original source snapshot', async t => {
  const { engine, store } = setup(t); const saved = engine.saveWorkflow(wf()); const task = engine.enqueue({ workflowId: saved.id }); engine.update(task, { state: 'awaiting_input' }); engine.saveWorkflow({ ...saved, source: 'Replacement' });
  const retry = engine.retry(task.id); assert.notEqual(retry.id, task.id); assert.equal(retry.snapshot.source, wf().source); assert.equal(store.get('task', task.id).state, 'awaiting_input');
});
test('explicit retry after a provider switch uses the current model and preserves the failed run',t=>{
 const {engine,store}=setup(t);
 const task=engine.enqueue({message:'Review the supplied fixture'});
 engine.update(task,{state:'failed',model:'qwen3.5:4b',error:'Previous model unavailable'});
 engine.env.GEMINI_MODEL='gemini-3.5-flash-lite';
 const retry=engine.retry(task.id);
 assert.equal(retry.model,'gemini-3.5-flash-lite');assert.equal(retry.previousModel,'qwen3.5:4b');
 assert.equal(store.get('task',task.id).model,'qwen3.5:4b');assert.equal(store.get('task',task.id).state,'failed');
});
test('explicit memory command persists and recall uses matching facts', async t => {
  const { engine, store } = setup(t); await engine.chat({ message: '/remember Prefer blue cars', conversationId: 'memory-chat' });
  assert.equal(store.list('memory').length, 1); const reply = await engine.chat({ message: '/recall blue', conversationId: 'memory-chat' }); assert.match(reply.message, /Prefer blue cars/);
});
test('conversation locks avoid competing turns and keep separate session context', async t => {
  let release; const held = new Promise(r => { release = r; });
  const { engine, store } = setup(t, async (contents) => { if (contents.at(-1).parts[0].text === 'Hold') await held; return { text: 'Fixture reply' }; });
  const first = engine.chat({ message: 'Hold', conversationId: 'chat-a' }); await assert.rejects(engine.chat({ message: 'Second', conversationId: 'chat-a' }), /already running/);
  await engine.chat({ message: 'Independent', conversationId: 'chat-b' }); release(); await first;
  assert.equal(store.get('conversation', 'chat-a').contents[0].parts[0].text, 'Hold'); assert.equal(store.get('conversation', 'chat-b').contents[0].parts[0].text, 'Independent');
});
test('invalid workflows and stale version saves are rejected', t => {
  const { engine } = setup(t); assert.throws(() => validateWorkflow({ ...wf(), source: '' }), /Source/); assert.throws(() => validateWorkflow({ ...wf(), steps: [{ id: 'gather', agent: 'editor', instruction: 'test' }] }), /Reserved/); assert.throws(() => validateWorkflow({ ...wf(), steps: [{ agent: 'email', instruction: 'Send' }] }), /configured/);
  const saved = engine.saveWorkflow(wf()); engine.saveWorkflow({ ...saved, source: 'New source' }); assert.throws(() => engine.saveWorkflow(saved), /changed/);
});
test('provider payload uses official generateContent shape and ignores thought parts', async () => {
  let payload;
  const reply = await generate([{ role: 'user', parts: [{ text: 'Fixture prompt' }] }], 'Fixture system', { env: fixtureEnv, fetcher: async (url, options) => { assert.match(url, /v1beta\/models\/fixture-model:generateContent$/); payload = JSON.parse(options.body); assert.equal(options.headers['x-goog-api-key'], fixtureEnv.GEMINI_API_KEY); return Response.json({ candidates: [{ content: { parts: [{ text: 'Private thought', thought: true }, { text: 'Visible result' }] } }] }); } });
  assert.equal(payload.systemInstruction.parts[0].text, 'Fixture system'); assert.equal(reply.text, 'Visible result');
});
test('provider errors do not reflect a secret supplied by an upstream response', async () => {
  await assert.rejects(generate([], '', { env: fixtureEnv, fetcher: async () => Response.json({ error: { message: fixtureEnv.GEMINI_API_KEY } }, { status: 403 }) }), error => error.message.includes('403') && !error.message.includes(fixtureEnv.GEMINI_API_KEY));
});

test('a queued task retains its configured model and rejects unavailable task agents', async t => {
  let selectedModel; const { engine, store } = setup(t, async (_, __, { env }) => { selectedModel = env.GEMINI_MODEL; return { text: 'Model fixture output' }; });
  assert.throws(() => engine.enqueue({ message: 'Fixture', agent: 'unknown_role' }), /configured handler/);
  const task = engine.enqueue({ message: 'Fixture task' }); engine.env.GEMINI_MODEL = 'changed-model'; await engine.tick();
  assert.equal(selectedModel, 'fixture-model'); assert.equal(store.get('task', task.id).model, 'fixture-model');
});

const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test('two background jobs overlap, foreground chat stays available, and the third waits for a slot', async t => {
  const held = gate(); const prompts = [];
  const { engine, store } = setup(t, async contents => {
    const prompt = contents.at(-1).parts[0].text;
    if (!prompt.startsWith('Task:')) return { text: 'Still available' };
    prompts.push(prompt); await held.promise; return { text: prompt };
  });
  t.after(() => held.resolve());
  const jobs = ['First private source', 'Second private source', 'Third private source'].map(message => engine.enqueue({ message }));
  const run = engine.tick(); await engine.tick();
  assert.equal(prompts.length, 2); assert.equal(engine.status().activeTasks.length, 2);
  assert.equal(store.get('task', jobs[2].id).state, 'queued');
  assert.equal((await engine.chat({ message: 'Hello', conversationId: 'parallel-chat' })).message, 'Still available');
  assert.doesNotMatch(prompts[0], /Second private source/); assert.doesNotMatch(prompts[1], /First private source/);
  held.resolve(); await run; await engine.tick();
  assert.equal(prompts.length, 3); assert.ok(jobs.every(job => store.get('task', job.id).state === 'completed'));
  assert.deepEqual(engine.status().activeTasks, []);
});
test('cancelling one worker leaves the other running and frees a slot for queued work', async t => {
  const held = gate(); let calls = 0;
  const { engine, store } = setup(t, async (_, __, { signal }) => {
    calls++;
    await Promise.race([held.promise, new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))]);
    return { text: 'Independent result' };
  });
  t.after(() => held.resolve());
  const jobs = [1,2,3].map(i => engine.enqueue({ message: `Job ${i}` }));
  const run = engine.tick(); const cancelledWorker = engine.workers.get(jobs[0].id).promise;
  engine.cancel(jobs[0].id); await cancelledWorker;
  assert.equal(store.get('task', jobs[0].id).state, 'cancelled');
  assert.equal(store.get('task', jobs[1].id).state, 'running');
  const next = engine.tick(); assert.equal(calls, 3); assert.equal(engine.workers.size, 2);
  held.resolve(); await Promise.all([run, next]);
  assert.equal(store.get('task', jobs[1].id).state, 'completed'); assert.equal(store.get('task', jobs[2].id).state, 'completed');
});
test('shutdown preserves partial results for review and keeps unstarted work queued', async t => {
  const secondStep = gate(); let calls = 0;
  const { engine, store } = setup(t, async (_, __, { signal }) => {
    if (++calls === 1) return { text: 'Saved first step' };
    secondStep.resolve(); await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  engine.concurrency = 1;
  const workflow = engine.saveWorkflow(wf()); const running = engine.enqueue({ workflowId: workflow.id });
  const queued = engine.enqueue({ message: 'Wait for a slot' }); const run = engine.tick(); await secondStep.promise;
  await engine.stop(); await run; await engine.tick();
  const interrupted = store.get('task', running.id);
  assert.equal(interrupted.state, 'awaiting_input'); assert.match(interrupted.result, /Saved first step/);
  assert.equal(store.get('task', queued.id).state, 'queued'); assert.equal(engine.workers.size, 0);
  assert.throws(() => engine.enqueue({ message: 'Too late' }), /stopping/);
});
test('explicit cancellation stays cancelled if shutdown happens at the same time', async t => {
  const { engine, store } = setup(t, async (_, __, { signal }) => {
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  const task = engine.enqueue({ message: 'Cancel then stop' }); const run = engine.tick();
  engine.cancel(task.id); await engine.stop(); await run;
  assert.equal(store.get('task', task.id).state, 'cancelled');
});
test('chat task commands return stored status and output without using the model', async t => {
  let calls = 0; const { engine, store } = setup(t, async () => { calls++; return { text: 'Saved result text' }; });
  const receipt = await engine.chat({ message: '/task Write a summary' }); const id = receipt.taskId.slice(0,8);
  assert.equal(calls, 0); assert.match((await engine.chat({ message: `/status ${id}` })).message, /queued/);
  await engine.tick(); assert.equal(calls, 1);
  assert.match((await engine.chat({ message: `/result ${id}` })).message, /Saved result text/); assert.equal(calls, 1);
  const queued = engine.enqueue({ message: 'Cancel from chat' });
  assert.match((await engine.chat({ message: `/cancel ${queued.id.slice(0,8)}` })).message, /cancelled/);
  const failed = engine.enqueue({ message: 'Retry from chat' }); engine.update(failed, { state: 'failed' });
  const retry = await engine.chat({ message: `/retry ${failed.id}` });
  assert.equal(store.get('task', retry.taskId).retryOf, failed.id); assert.notEqual(retry.taskId, failed.id);
  await assert.rejects(engine.chat({ message: '/status abc' }), /at least eight/);
  await assert.rejects(engine.chat({ message: '/result deadbeef' }), /not found/);
});
test('ambiguous short task IDs never operate on an arbitrary task', async t => {
  const { engine, store } = setup(t);
  store.put('task', { id: '12345678-a', state: 'queued' }); store.put('task', { id: '12345678-b', state: 'queued' });
  await assert.rejects(engine.chat({ message: '/cancel 12345678' }), /ambiguous/);
  assert.equal(store.get('task', '12345678-a').state, 'queued');
});
test('concurrency configuration is bounded and invalid values fail at startup', t => {
  const { store } = setup(t);
  for (const value of ['0','4','-1','1.5','invalid','']) assert.throws(() => new Engine(store, { env: { APEX_BACKGROUND_CONCURRENCY: value } }), /must be 1, 2 or 3/);
  assert.equal(new Engine(store, { env: { APEX_BACKGROUND_CONCURRENCY: '1' } }).concurrency, 1);
});
