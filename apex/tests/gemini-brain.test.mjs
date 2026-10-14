import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,brainConfig} from '../runtime/provider.mjs';
import {planSchema} from '../runtime/task-loop.mjs';
const env={APEX_PROVIDER:'gemini',GEMINI_API_KEY:'mock-private-key',GEMINI_MODEL:'gemini-3.5-flash-lite'};
test('Gemini sends the configured model, server-only key, history and system instruction, never Ollama',async()=>{
 let calls=0;const chunks=[];
 const result=await generate([{role:'user',parts:[{text:'Mock question'}]}],'Personality instruction',{env,onText:text=>chunks.push(text),fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(options.headers['x-goog-api-key'],'mock-private-key');
  const body=JSON.parse(options.body);assert.equal(body.systemInstruction.parts[0].text,'Personality instruction');assert.equal(body.contents[0].parts[0].text,'Mock question');
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'Private reasoning'},{text:'Mock final answer'}]}}]});
 }});
 assert.equal(calls,1);assert.equal(result.text,'Mock final answer');assert.deepEqual(chunks,['Mock final answer']);assert.equal(brainConfig(env).provider,'gemini');
});
test('model and quota failures give actionable messages without echoing provider secrets',async()=>{
 for(const [status,expected] of [[404,/gemini-3.5-flash-lite.*unavailable/],[429,/quota or rate limit/],[403,/permission was rejected/]])await assert.rejects(generate([], '',{env,fetcher:async()=>Response.json({error:{message:'mock-private-key'}},{status})}),error=>expected.test(error.message)&&!error.message.includes('mock-private-key'));
});
test('Gemini preserves JSON output for acknowledgments and task loop schemas',async()=>{
 for(const format of ['json',planSchema([{id:'editor'}])])await generate([], 'Mock instruction',{env,format,maxTokens:96,fetcher:async(_,options)=>{
  const config=JSON.parse(options.body).generationConfig;assert.equal(config.responseMimeType,'application/json');assert.equal(config.maxOutputTokens,96);
  if(typeof format==='object'){assert.equal(config.responseSchema.additionalProperties,undefined);assert.deepEqual(config.responseSchema.properties.steps.items.properties.handler.enum,['text']);}
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]});
 }});
});
test('Gemini failures and partial replies never fall back to Qwen or emit completed text',async()=>{
 let calls=0,chunks=0;
 for(const response of [Response.json({error:{message:'mock-private-key'}},{status:404}),Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'Partial answer'}]}}]})]){
  await assert.rejects(generate([], '',{env,onText:()=>chunks++,fetcher:async()=>{calls++;return response;}}),error=>!error.message.includes('mock-private-key'));
 }
 assert.equal(calls,2);assert.equal(chunks,0);
});
