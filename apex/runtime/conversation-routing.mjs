// Conservative English command routing. Supplied documents never enter this router.
export function conversationIntent(message, language = 'English') {
  if (language !== 'English' || message.startsWith('/')) return null;
  const request = message.trim().replace(/^(?:nova|apex)[,\s]+/i, '')
    .replace(/^(?:(?:can|could|would) you\s+|please\s+|i (?:want|need) you to\s+)+/i, '').trim();
  const plain = request.toLowerCase().replace(/[?.!]+$/, '').trim();
  if (/^(?:is (?:it|that|the task|the report|the draft|the research) ready|what(?:'s| is) still running|how is (?:the |my )?.+ (?:going|doing))$/.test(plain)) return {type:'status'};
  const cancel = request.match(/^(?:cancel|stop) (?:task\s+)?([a-z0-9-]{8,80}|that task|the task|my task)$/i);
  if(cancel) return {type:'cancel',reference:cancel[1]};
  const amendment=request.match(/^(?:update|change) task ([a-z0-9-]{8,80}) (?:to|:)\s+(.+)$/i);
  if(amendment)return {type:'amend',reference:amendment[1],request:amendment[2]};
  if (/^(?:how (?:is|are) (?:it|the task|the tasks|my task|my tasks|the work|things) (?:going|doing)|(?:are you|is it) (?:still )?(?:working|processing|done)|what are you (?:working on|doing|concentrating on)|(?:any|give me a|give me an) (?:progress|status|update)|how long (?:will it|will this|is it going to) take)$/.test(plain)) return {type:'status'};
  if (/^(?:take your time|thanks|thank you|okay|ok|alright)$/.test(plain)) return {type:'acknowledgment'};
  const read=request.match(/^(read|show|check|list|search|summari[sz]e)\s+(?:(?:my|the)\s+)?(gmail|inbox|emails|google calendar|calendar|google drive|drive files|drive)(?:\s+(.+))?$/i);
  if(read){const noun=read[2].toLowerCase(),agent=/calendar/.test(noun)?'calendar':/drive/.test(noun)?'drive':'email';return {type:'task',request,agent,toolInput:{operation:'read',...(agent!=='calendar'&&/^search$/i.test(read[1])&&read[3]?{query:read[3].replace(/^for\s+/i,'')} :{}),...(/^summari[sz]e$/i.test(read[1])?{summarize:true}:{})}};}
  // An explicit background goal is validated by the closed-loop planner, which
  // must ask for input if an external action or unavailable source is needed.
  const explicit = request.match(/^(?:start (?:a )?(?:background )?task(?: to|:)?|work (?:on this )?in (?:the )?background:?)\s+(.+)$/i);
  if (explicit) return {type:'task', request:explicit[1]};
  if (/^(?:draft|write|summari[sz]e|analy[sz]e|review|compare|prepare|revise|proofread|research|investigate|diagnose|troubleshoot|plan|create|organise|organize)\s+\S/i.test(request)) return {type:'task',request};
  return null;
}

export function taskStatusReply(tasks, question = '') {
  if(tasks.length>1&&!/what.*(?:doing|working|running)|tasks|things|status|progress|update/i.test(question)&&question){
    const keywords=question.toLowerCase().match(/[a-z]{4,}/g)||[];
    const matches=tasks.filter(t=>keywords.some(word=>!['ready','going','doing','still','long','take','research'].includes(word)&&t.request?.toLowerCase().includes(word))||(/research/i.test(question)&&/research/i.test(t.request||'')));
    if(matches.length===1)tasks=matches;
    else return `Which task do you mean? ${tasks.slice(0,5).map(t=>`${t.id?.slice(0,8)||'?'}: ${t.request}`).join('; ')}.`;
  }
  const active = tasks.filter(t=>['queued','running','cancellation_requested','awaiting_input'].includes(t.state));
  if (!active.length) {
    const latest = tasks[0];
    return latest ? `The latest task is ${latest.state}. ${latest.state==='completed'?'Its saved result is in Tasks.':latest.progress}` : 'I do not have a background task running yet.';
  }
  const lines = active.slice(0,3).map(t=>`${t.request.slice(0,100).replace(/[.!?]+$/, '')}: ${t.state==='queued'?'queued, waiting for a worker':t.state==='running'?`in progress, ${t.progress}`:t.state==='awaiting_input'?'needs your input or review':'stopping'}.`);
  return `${/how long/i.test(question)?'I cannot give a reliable finish time yet. ':''}${lines.join(' ')}${active.length>3?` There are ${active.length-3} more tasks in Tasks.`:''}`;
}

export const publicTaskState=task=>task.state==='awaiting_input'?(task.error?.includes('confirmation')?'Awaiting approval':'Blocked'):({queued:'Queued',running:'Working',completed:'Completed',failed:'Failed',cancelled:'Cancelled',cancellation_requested:'Cancellation requested'}[task.state]||task.state);
export function taskReceipt(task){return `Task ${task.id.slice(0,8)}: ${publicTaskState(task)}. ${task.progress}${task.error?` — ${task.error}`:''}${task.state==='completed'?`\n${task.result||'No output was returned.'}`:''}`;}
