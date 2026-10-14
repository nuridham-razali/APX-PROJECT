import {randomUUID} from 'node:crypto';
import {brainConfig} from './provider.mjs';
import {jsonLines} from '../lib/json-stream.mjs';
import {HERMES_READ_TOOLS} from './hermes-adapter.mjs';

export function ollamaMessages(messages){return messages.map(message=>{
  if(!message||!['system','developer','user','assistant','tool'].includes(message.role))throw new Error('Unsupported Hermes message role.');
  let content=message.content??'';
  if(Array.isArray(content)){if(content.some(p=>p.type!=='text'||typeof p.text!=='string'))throw new Error('Only text is supported in this gateway.');content=content.map(p=>p.text).join('\n');}
  if(typeof content!=='string')throw new Error('Invalid model message text.');
  const calls=message.tool_calls?.map(call=>{const name=call.function?.name;if(!HERMES_READ_TOOLS.has(name))throw new Error('History contains an unpermitted tool.');const args=typeof call.function.arguments==='string'?JSON.parse(call.function.arguments):call.function.arguments;if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Invalid tool arguments.');return {function:{name,arguments:args}};});
  return {role:message.role==='developer'?'system':message.role,content,...(calls?.length?{tool_calls:calls}:{}),...(message.role==='tool'&&typeof message.name==='string'?{tool_name:message.name}:{})};
});}

export async function hermesModelRequest(body,{env=process.env,store,fetcher=fetch,signal,onChunk}={}){
  const brain=brainConfig(env);
  if(brain.provider!=='ollama')throw new Error('Paid inference is blocked at the Hermes model gateway.');
  if(body.model!==brain.model)throw new Error('Hermes must use APEX’s selected model.');
  const context=Number(env.APEX_HERMES_CONTEXT_LENGTH||8192);
  if(!Number.isInteger(context)||context<64000||context>131072)throw new Error('Hermes requires an explicitly configured compatible context of at least 64000 tokens.');
  if(!Array.isArray(body.messages)||body.messages.length>100||JSON.stringify(body.messages).length>180000)throw new Error('Invalid Hermes model messages.');
  const messages=ollamaMessages(body.messages);
  const tools=body.tools||[];
  if(!Array.isArray(tools)||tools.some(t=>t.type!=='function'||!HERMES_READ_TOOLS.has(t.function?.name)))throw new Error('Hermes model tools exceed the permitted read-only profile.');
  const max=Number(env.APEX_HERMES_DAILY_CALL_LIMIT||100);
  if(!Number.isInteger(max)||max<1||max>1000)throw new Error('Invalid Hermes daily call budget.');
  const date=new Date().toISOString().slice(0,10),id=`hermes-${date}`,budget=store.get('usage_guard',id)||{id,calls:0};
  if(budget.calls>=max)throw new Error('Hermes daily inference budget reached.');
  // Reserve before sending; failed and interrupted calls still count.
  store.put('usage_guard',{...budget,calls:budget.calls+1,updatedAt:new Date().toISOString()});
  const response=await fetcher(`${brain.base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000),body:JSON.stringify({model:brain.model,messages,tools,stream:true,...(brain.model.startsWith('qwen3')?{think:false}:{}),options:{num_ctx:context,num_predict:Math.max(32,Math.min(2048,Number(body.max_tokens)||2048)),temperature:.45},keep_alive:'10m'})});
  if(!response.ok)throw new Error(`Local model returned HTTP ${response.status}.`);
  const completionId=`chatcmpl-${randomUUID()}`,created=Math.floor(Date.now()/1000);let answer='',calls=[],finished=false,usage={},truncated=false;
  for await(const part of jsonLines(response.body,signal)){
    if(part.error)throw new Error('Local model failed during the Hermes turn.');
    const message=part.message||{},delta={};
    if(message.content){answer+=message.content;delta.content=message.content;}
    if(message.tool_calls?.length){if(message.tool_calls.some(t=>!HERMES_READ_TOOLS.has(t.function?.name)))throw new Error('Model attempted an unpermitted tool.');const start=calls.length;calls.push(...message.tool_calls);delta.tool_calls=message.tool_calls.map((t,i)=>({index:start+i,id:`call_${randomUUID()}`,type:'function',function:{name:t.function.name,arguments:JSON.stringify(t.function.arguments)}}));}
    if(answer.length>50000)throw new Error('Local model output exceeded its limit.');
    if(Object.keys(delta).length)onChunk?.({id:completionId,object:'chat.completion.chunk',created,model:brain.model,choices:[{index:0,delta,finish_reason:null}]});
    if(part.done){finished=true;truncated=part.done_reason==='length';usage={prompt_tokens:part.prompt_eval_count||0,completion_tokens:part.eval_count||0,total_tokens:(part.prompt_eval_count||0)+(part.eval_count||0)};break;}
  }
  if(!finished)throw new Error('Local model response was interrupted.');
  const finish_reason=truncated?'length':calls.length?'tool_calls':'stop';
  onChunk?.({id:completionId,object:'chat.completion.chunk',created,model:brain.model,choices:[{index:0,delta:{},finish_reason}],usage});
  return {id:completionId,object:'chat.completion',created,model:brain.model,choices:[{index:0,message:{role:'assistant',content:answer,...(calls.length?{tool_calls:calls.map(t=>({id:`call_${randomUUID()}`,type:'function',function:{name:t.function.name,arguments:JSON.stringify(t.function.arguments)}}))}:{})},finish_reason}],usage};
}
