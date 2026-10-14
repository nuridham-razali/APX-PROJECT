import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Engine } from '../runtime/engine.mjs';
import { Store } from '../runtime/store.mjs';
import { validatePlan, validateReview, LOOP_LIMITS } from '../runtime/task-loop.mjs';
const step = { handler: 'text', agent: 'editor', instruction: 'Summarise the supplied notes.', acceptance: ['Include the supplied deadline.'] };
const plan = steps => JSON.stringify({ status: 'ready', steps });
const review = (passed, feedback = 'Deadline checked against supplied notes.') => JSON.stringify({ passed, feedback });
function setup(t, generator) {
  const dir = mkdtempSync(join(tmpdir(), 'apex-loop-')); const store = new Store(join(dir, 'test.sqlite'));
  const engine = new Engine(store, { generator, env: { GEMINI_API_KEY: 'fixture-only', GEMINI_MODEL: 'fixture' } });
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  return { engine, store };
}
test('plans reject unregistered handlers, extra tool fields and invalid check verdicts', () => {
  assert.throws(() => validatePlan(plan([{ ...step, handler: 'shell' }]), ['editor']), /not connected/);
  assert.throws(() => validatePlan(plan([{ ...step, agent: 'outlook' }]), ['editor']), /not connected/);
  assert.throws(() => validatePlan(plan([{ ...step, command: 'send' }]), ['editor']), /unsupported fields/);
  assert.throws(() => validatePlan(plan(Array(5).fill(step)), ['editor']), /one to four/);
  assert.throws(() => validateReview('{"passed":"true","feedback":"ok"}'), /explicitly/);
});
test('a real saved task loops through plan, execution, review and reporting with isolated source', async t => {
  const prompts = []; let calls = 0;
  const { engine, store } = setup(t, async (contents, system) => {
    prompts.push(JSON.parse(contents[0].parts[0].text)); calls++;
    assert.match(system, /You are NOVA/);
    return { text: calls === 1 ? plan([step, { ...step, instruction: 'Polish the previous summary.' }]) : calls % 2 === 0 ? `Deadline: Friday. Draft ${calls}` : review(true) };
  });
  const queued = engine.enqueue({ mode: 'closed_loop', message: 'Summarise then polish.', source: 'Source A: Deadline Friday.', assistant: 'NOVA' });
  await engine.tick(); const task = store.get('task', queued.id);
  assert.equal(task.state, 'completed'); assert.equal(task.loopCalls, 5); assert.equal(task.steps.length, 3);
  assert.ok(task.steps.slice(1).every(s => s.checks[0].passed));
  assert.equal(prompts[3].source, 'Source A: Deadline Friday.'); assert.match(prompts[3].acceptedOutputs[0].output, /Draft 2/);
  assert.match(task.result, /Draft 4/);
});
test('failed checks allow only one revision, then block dependents and retain the unverified draft', async t => {
  let calls = 0;
  const { engine, store } = setup(t, async () => { calls++; return { text: calls === 1 ? plan([step, step]) : calls % 2 === 0 ? 'Missing deadline draft' : review(false, 'The deadline is missing.') }; });
  const queued = engine.enqueue({ mode: 'closed_loop', message: 'Summarise notes', source: 'Friday deadline.' });
  await engine.tick(); const task = store.get('task', queued.id);
  assert.equal(calls, 5); assert.equal(task.state, 'awaiting_input'); assert.equal(task.steps[1].attempts, 2);
  assert.equal(task.steps[1].checks.length, 2); assert.equal(task.steps[2].state, 'blocked'); assert.equal(task.result, '');
  assert.match(task.steps[1].output, /Missing deadline/);
  const retried = engine.retry(task.id); assert.equal(retried.loopCalls, 0); assert.equal(retried.steps.length, 1); assert.equal(retried.loopSource, 'Friday deadline.');
});
test('a planner reporting unavailable actions stops without executing or silently drafting', async t => {
  let calls = 0;
  const { engine, store } = setup(t, async () => { calls++; return { text: JSON.stringify({ status: 'needs_input', reason: 'Outlook sending is not connected.', steps: [] }) }; });
  const queued = engine.enqueue({ mode: 'closed_loop', message: 'Send an Outlook email.' }); await engine.tick();
  assert.equal(calls, 1); const task = store.get('task', queued.id); assert.equal(task.state, 'awaiting_input'); assert.equal(task.result, ''); assert.match(task.error, /not connected/);
});
test('provider failures are not silently retried and preserve the current plan', async t => {
  let calls = 0;
  const { engine, store } = setup(t, async () => { if (++calls === 1) return { text: plan([step]) }; throw new Error('Fixture provider failure'); });
  const queued = engine.enqueue({ mode: 'closed_loop', message: 'Summarise notes.' }); await engine.tick();
  const task = store.get('task', queued.id); assert.equal(calls, 2); assert.equal(task.state, 'failed'); assert.equal(task.steps[0].state, 'completed'); assert.equal(task.steps[1].state, 'failed');
});
test('cancellation during review retains the draft and cannot mark a task completed', async t => {
  let began; const ready = new Promise(r => { began = r; }); let calls = 0;
  const { engine, store } = setup(t, async (_, __, { signal }) => {
    if (++calls === 1) return { text: plan([step]) }; if (calls === 2) return { text: 'Friday deadline.' };
    began(); await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  });
  const queued = engine.enqueue({ mode: 'closed_loop', message: 'Summarise notes.' }); const running = engine.tick(); await ready;
  engine.cancel(queued.id); await running; const task = store.get('task', queued.id);
  assert.equal(task.state, 'cancelled'); assert.equal(task.steps[1].state, 'cancelled'); assert.equal(task.steps[1].output, 'Friday deadline.'); assert.equal(task.result, '');
});
test('foreground conversation stays available while a loop is checking its output', async t => {
  let began, release; const ready = new Promise(r => { began = r; }); const held = new Promise(r => { release = r; });
  const { engine, store } = setup(t, async (_, system) => {
    if (system.includes('TASK LOOP PLANNER')) return { text: plan([step]) };
    if (system.includes('TASK LOOP EXECUTOR')) return { text: 'Friday deadline.' };
    if (system.includes('TASK LOOP REVIEWER')) { began(); await held; return { text: review(true) }; }
    return { text: 'I am available.' };
  });
  const queued = engine.enqueue({ mode: 'closed_loop', message: 'Summarise notes.' }); const running = engine.tick(); await ready;
  const answer = await engine.chat({ conversationId: 'foreground', message: 'Are you available?' }); assert.equal(answer.message, 'I am available.'); assert.equal(store.get('task', queued.id).state, 'running');
  release(); await running; assert.equal(store.get('task', queued.id).state, 'completed');
});
test('four steps with a revision each reach the fixed call cap without an endless loop', async t => {
  let calls = 0;
  const { engine, store } = setup(t, async () => {
    calls++; if (calls === 1) return { text: plan(Array(4).fill(step)) };
    const phase = (calls - 2) % 4;
    return { text: phase === 0 || phase === 2 ? 'Friday deadline.' : review(phase === 3, phase === 3 ? 'Deadline present.' : 'Revise phrasing.') };
  });
  const queued = engine.enqueue({ mode: 'closed_loop', message: 'Review supplied notes.' }); await engine.tick();
  assert.equal(store.get('task', queued.id).state, 'completed'); assert.equal(calls, LOOP_LIMITS.providerCalls);
});
test('/loop queues a real loop receipt without executing inside foreground chat', async t => {
  let calls = 0; const { engine, store } = setup(t, async () => { calls++; throw new Error('Should not run'); });
  const reply = await engine.chat({ message: '/loop Draft a summary from supplied notes.', conversationId: 'loop-command' });
  assert.equal(calls, 0); const task = store.get('task', reply.taskId); assert.equal(task.mode, 'closed_loop'); assert.equal(task.state, 'queued'); assert.match(reply.message, new RegExp(task.id.slice(0,8)));
});
