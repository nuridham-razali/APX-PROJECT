// Presentation uses pending requests and current execution receipts, never old node events.
export function requestPhase(phase, pending) {
  return pending && phase === 'idle' ? 'thinking' : phase;
}
export function hasAssistantWork(snapshot, assistant = 'APEX') {
  return (snapshot?.tasks || []).some(task =>
    (task.assistant || 'APEX') === assistant && ['queued', 'running', 'cancellation_requested'].includes(task.state)
  ) || (assistant === 'APEX' && (snapshot?.loops || []).some(loop => loop.state === 'Running'));
}
export function assistantActivity(activity, working, pending = false) {
  if (pending && activity !== 'speaking') return 'thinking';
  // Background work belongs to task nodes; the orb reports foreground conversation.
  return activity;
}
