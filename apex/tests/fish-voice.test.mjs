import test from 'node:test';
import assert from 'node:assert/strict';
import {fishSpeak,fishStatus,NOVA_VOICE_ID,FISH_MODEL} from '../runtime/fish-voice.mjs';

test('NOVA sends the selected voice and an explicit free-tier model, returning MP3', async()=>{
  let called=0;
  const result=await fishSpeak({text:'Hello NOVA.'},{env:{FISH_API_KEY:'test-private-key',FISH_MODEL:'paid-or-invalid'},fetchImpl:async(url,options)=>{
    called++;
    assert.equal(url,'https://api.fish.audio/v1/tts');
    assert.equal(options.headers.model,'s2.1-pro-free');
    assert.equal(options.headers.Authorization,'Bearer test-private-key');
    assert.deepEqual(JSON.parse(options.body),{text:'Hello NOVA.',reference_id:NOVA_VOICE_ID,format:'mp3',latency:'normal',prosody:{speed:1,volume:0,normalize_loudness:true}});
    return new Response(new Uint8Array([73,68,51]),{status:200});
  }});
  assert.equal(called,1);assert.equal(result.audio,'SUQz');assert.equal(result.mime,'audio/mpeg');assert.equal(result.model,FISH_MODEL);
  assert.equal(JSON.stringify(result).includes('test-private-key'),false);
});
test('missing credentials and invalid text never call Fish Audio',async()=>{
  const fetchImpl=()=>{throw new Error('Must not send');};
  assert.equal(fishStatus({}).ready,false);
  await assert.rejects(fishSpeak({text:'Hello'},{env:{},fetchImpl}),/FISH_API_KEY/);
  await assert.rejects(fishSpeak({text:' '},{env:{FISH_API_KEY:'test'},fetchImpl}),/1–1500/);
});

test('APEX uses its own configured Fish voice while NOVA keeps its selected voice',async()=>{
  const voice='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',env={FISH_API_KEY:'fixture-secret',APEX_FISH_VOICE_ID:voice};
  assert.equal(fishStatus(env,'APEX').voiceId,voice);assert.equal(fishStatus(env).voiceId,NOVA_VOICE_ID);
  const result=await fishSpeak({assistant:'APEX',text:'Hello APEX.'},{env,fetchImpl:async(url,options)=>{assert.equal(url,'https://api.fish.audio/v1/tts');assert.equal(JSON.parse(options.body).reference_id,voice);assert.equal(options.headers.model,FISH_MODEL);return new Response(new Uint8Array([73,68,51]));}});
  assert.equal(result.voice,voice);assert.equal(result.provider,'Fish Audio');assert.doesNotMatch(JSON.stringify(result),/fixture-secret/);
});

test('APEX requires a Fish voice ID and does not reuse an incompatible provider ID',async()=>{
  for(const voice of ['', 'alwWf0yOMMykcrIh8BlE']){
    const env={FISH_API_KEY:'fixture-secret',APEX_FISH_VOICE_ID:voice};assert.equal(fishStatus(env,'APEX').ready,false);
    await assert.rejects(fishSpeak({assistant:'APEX',text:'Hello.'},{env,fetchImpl:()=>{throw new Error('Must not call');}}),/APEX_FISH_VOICE_ID/);
  }
});
test('free-tier errors are sanitized without retrying a paid model',async()=>{
  let calls=0;
  await assert.rejects(fishSpeak({text:'Hello'},{env:{FISH_API_KEY:'secret'},fetchImpl:async()=>{calls++;return new Response('private upstream secret',{status:402});}}),/free tier is unavailable/);
  assert.equal(calls,1);
});
test('empty and oversized audio is rejected',async()=>{
  for(const bytes of [new Uint8Array(),new Uint8Array(8000001)]){
    await assert.rejects(fishSpeak({text:'Hello'},{env:{FISH_API_KEY:'test'},fetchImpl:async()=>new Response(bytes)}),/no audio|too large/);
  }
});
