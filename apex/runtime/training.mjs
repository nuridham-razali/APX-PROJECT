import {InputError,text} from './engine.mjs';
import {persona} from './provider.mjs';
export function saveCorrection(store, body) {
  const id=text(body.conversationId,'Conversation ID',80);
  const contents=store.get('conversation',id)?.contents;
  if(!contents?.length)throw new InputError('No saved conversation to correct.',404);
  const answer=contents.at(-1),prompt=contents.at(-2);
  if(answer?.role!=='model'||prompt?.role!=='user')throw new InputError('The last saved turn cannot be corrected.');
  if(body.original!==answer.parts.map(p=>p.text||'').join(''))throw new InputError('A newer reply arrived. Review the latest turn before saving.',409);
  const correction=text(body.correction,'Corrected reply',16000);
  const assistant=body.assistant==='NOVA'?'NOVA':'APEX';
  return store.create('training',{prompt:prompt.parts.map(p=>p.text||'').join(''),original:body.original,correction,assistant,approved:true,system:persona(body.language,{},assistant),model:body.model||'unknown'});
}
export function exportCorrections(store) {
  const examples=store.list('training').filter(x=>x.approved===true);
  return {count:examples.length,dataset:examples.map(x=>JSON.stringify({messages:[{role:'system',content:x.system},{role:'user',content:x.prompt},{role:'assistant',content:x.correction}]})).join('\n')+(examples.length?'\n':'')};
}
